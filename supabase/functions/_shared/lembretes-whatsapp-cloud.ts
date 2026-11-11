// Núcleo do envio de lembretes de 1 dia pela WhatsApp Cloud API.
//
// Por linha (tudo validado na base de dados, nunca nos campos editáveis da fila):
//   1. whatsapp_cloud_preparar          estado ATUAL: profissional, marcação, agenda da
//                                        cliente, consentimento explícito, opt-out, janela
//   2. telefone E.164 + hash HMAC + chave (marcação + data) + assinatura (hora + destino)
//   3. whatsapp_cloud_reservar          idempotência + bloqueio global + limites ATÓMICOS
//                                        (por número e por profissional)
//   4. preparar outra vez + comparar     a marcação ainda é a mesma versão?
//      whatsapp_cloud_confirmar_reserva a linha ainda existe? chegou um PARAR?
//   5. pedido à Meta
//   6. whatsapp_cloud_registar_resultado aceite / rejeitado / incerto
//
// Chamado pela Edge Function processar-whatsapp-cloud (cron próprio, desativado).

import {
  assinaturaVersao,
  chaveIdempotencia,
  ConfigWhatsappCloud,
  enviarTemplate,
  parametrosLembrete24h,
  PedidoTemplate,
  ResultadoEnvio,
  sanitizar,
  TEMPLATE_LEMBRETE_24H,
} from "./whatsapp-cloud.ts";
import { mascararTelefone, normalizarTelefone } from "./telefone.ts";

export type LinhaFila = { id: string; tentativas: number };

export type PreparadoOk = {
  ok: true;
  fila_id: string;
  usuario_id: string;
  agendamento_id: string;
  tipo: string;
  antecedencia: string;
  versao_marcacao: string;
  telefone: string;
  cliente_nome: string;
  profissional_nome: string;
  data: string;
  hora: string;
  procedimento: string;
  tentativa_fila: number;
};
export type Preparado = { ok: false; motivo: string } | PreparadoOk;

export type Reserva =
  | { reservado: true; envio_id: string }
  | { reservado: false; motivo: string; estado_existente?: string | null };

export type ArgsReserva = {
  filaId: string; chave: string; assinatura: string; agendamentoId: string; usuarioId: string;
  tipo: string; antecedencia: string; versaoMarcacao: string; telefoneHash: string;
  telefoneMascarado: string; template: string; idioma: string; phoneNumberId: string;
};

export interface RepositorioWhatsappCloud {
  expirarReservas(minutos: number): Promise<number>;
  reivindicar(limite: number, maxTentativas: number): Promise<LinhaFila[]>;
  preparar(filaId: string): Promise<Preparado>;
  reservar(args: ArgsReserva): Promise<Reserva>;
  confirmarReserva(envioId: string, filaId: string, telefoneHash: string): Promise<{ ok: boolean; motivo?: string }>;
  libertarReserva(envioId: string, filaId: string, motivo: string): Promise<void>;
  adiar(filaId: string, minutos: number, motivo: string): Promise<void>;
  registarResultado(args: {
    envioId: string; filaId: string; resultado: "aceite" | "rejeitado" | "incerto"; wamid: string | null;
    retentavel: boolean | null; erroCodigo: string | null; erroDetalhe: string | null;
    atrasoSegundos: number; maxTentativas: number;
  }): Promise<string>;
  cancelar(filaId: string, motivo: string): Promise<void>;
}

export type Enviador = (config: ConfigWhatsappCloud, pedido: PedidoTemplate) => Promise<ResultadoEnvio>;

export type Contagens = {
  reivindicadas: number;
  aceites: number;
  rejeitadas: number;
  novas_tentativas: number;
  incertas: number;
  canceladas: number;
  duplicadas: number;
  adiadas: number;
  libertadas_antes_de_enviar: number;
  nao_processadas_por_tempo: number;
  erros_internos: number;
  reservas_expiradas: number;
};

export type OpcoesProcessamento = {
  hashTelefone: (e164: string) => Promise<string>;
  limite?: number;
  maxTentativas?: number;
  atrasoBaseSegundos?: number;
  minutosExpiracaoReserva?: number;
  minutosAdiamento?: number;
  prazoMs?: number;                // tempo máximo da execução (Edge Functions têm limite)
  agora?: () => number;
  enviar?: Enviador;
  log?: (msg: string) => void;
};

// Motivos de recusa da reserva que significam "mais tarde" e não "nunca".
const MOTIVOS_ADIAR = new Set(["limite_diario_numero", "limite_diario_profissional", "numero_inativo"]);

export async function processarLembretesWhatsappCloud(
  repo: RepositorioWhatsappCloud,
  config: ConfigWhatsappCloud,
  opcoes: OpcoesProcessamento,
): Promise<Contagens> {
  const limite = opcoes.limite ?? 20;
  const maxTentativas = opcoes.maxTentativas ?? 3;
  const atrasoBase = opcoes.atrasoBaseSegundos ?? 600;
  const minutosAdiamento = opcoes.minutosAdiamento ?? 30;
  const agora = opcoes.agora ?? (() => Date.now());
  const fim = agora() + (opcoes.prazoMs ?? 40_000);
  const enviar = opcoes.enviar ?? ((c, p) => enviarTemplate(c, p));
  const log = opcoes.log ?? ((m) => console.log(m));

  const c: Contagens = {
    reivindicadas: 0, aceites: 0, rejeitadas: 0, novas_tentativas: 0, incertas: 0, canceladas: 0,
    duplicadas: 0, adiadas: 0, libertadas_antes_de_enviar: 0, nao_processadas_por_tempo: 0,
    erros_internos: 0, reservas_expiradas: 0,
  };

  c.reservas_expiradas = await repo.expirarReservas(opcoes.minutosExpiracaoReserva ?? 10);
  const linhas = await repo.reivindicar(limite, maxTentativas);
  c.reivindicadas = linhas.length;

  for (const linha of linhas) {
    if (agora() >= fim) {
      // Sem tempo: devolve à fila sem gastar tentativa (nada foi pedido à Meta).
      await repo.adiar(linha.id, 0, "sem_tempo_nesta_execucao").catch(() => {});
      c.nao_processadas_por_tempo++;
      continue;
    }

    let envioId: string | null = null;
    try {
      const prep = await repo.preparar(linha.id);
      if (!prep.ok) {
        await repo.cancelar(linha.id, prep.motivo);
        c.canceladas++;
        log(`[wa-cloud] fila ${linha.id}: cancelada (${prep.motivo})`);
        continue;
      }

      const tel = normalizarTelefone(prep.telefone);
      if (!tel.ok) {
        await repo.cancelar(linha.id, `telefone_invalido:${tel.motivo}`);
        c.canceladas++;
        continue;
      }
      const tpl = TEMPLATE_LEMBRETE_24H;
      const telefoneHash = await opcoes.hashTelefone(tel.e164);
      const chave = await chaveIdempotencia({
        agendamentoId: prep.agendamento_id, tipo: prep.tipo, antecedencia: prep.antecedencia,
        data: prep.data, template: tpl.nome, idioma: tpl.idioma,
      });
      const assinatura = await assinaturaVersao({ hora: prep.hora, e164: tel.e164, template: tpl.nome, idioma: tpl.idioma });

      const reserva = await repo.reservar({
        filaId: linha.id, chave, assinatura, agendamentoId: prep.agendamento_id, usuarioId: prep.usuario_id,
        tipo: prep.tipo, antecedencia: prep.antecedencia, versaoMarcacao: prep.versao_marcacao,
        telefoneHash, telefoneMascarado: mascararTelefone(tel.e164), template: tpl.nome, idioma: tpl.idioma,
        phoneNumberId: config.phoneNumberId,
      });
      if (!reserva.reservado) {
        if (MOTIVOS_ADIAR.has(reserva.motivo)) {
          await repo.adiar(linha.id, minutosAdiamento, reserva.motivo);
          c.adiadas++;
        } else {
          await repo.cancelar(linha.id, reserva.estado_existente ? `${reserva.motivo}:${reserva.estado_existente}` : reserva.motivo);
          if (reserva.motivo === "duplicado") c.duplicadas++;
          else c.canceladas++;
        }
        log(`[wa-cloud] fila ${linha.id}: não reservada (${reserva.motivo})`);
        continue;
      }
      envioId = reserva.envio_id;

      // 4. A marcação ainda é a mesma? (edição/remarcação entre a reserva e o envio)
      const atual = await repo.preparar(linha.id);
      const atualTel = atual.ok ? normalizarTelefone(atual.telefone) : null;
      const motivoMudanca = !atual.ok
        ? atual.motivo
        : atual.versao_marcacao !== prep.versao_marcacao
        ? "marcacao_alterada"
        : !atualTel?.ok || atualTel.e164 !== tel.e164
        ? "telefone_alterado"
        : null;
      if (motivoMudanca) {
        await repo.libertarReserva(envioId, linha.id, motivoMudanca);
        c.libertadas_antes_de_enviar++;
        log(`[wa-cloud] fila ${linha.id}: reserva libertada antes do envio (${motivoMudanca})`);
        continue;
      }
      const confirmacao = await repo.confirmarReserva(envioId, linha.id, telefoneHash);
      if (!confirmacao.ok) {
        c.libertadas_antes_de_enviar++;
        log(`[wa-cloud] fila ${linha.id}: reserva libertada antes do envio (${confirmacao.motivo})`);
        continue;
      }

      const res = await enviar(config, {
        agendamentoId: prep.agendamento_id,
        usuarioId: prep.usuario_id,
        telefone: tel.e164,
        template: tpl.nome,
        idioma: tpl.idioma,
        parametros: parametrosLembrete24h({
          clienteNome: prep.cliente_nome, profissionalNome: prep.profissional_nome,
          data: prep.data, hora: prep.hora, procedimento: prep.procedimento,
        }),
        numeroParametrosEsperado: tpl.numeroParametros,
      });

      const atraso = atrasoBase * 2 ** Math.max(0, (linha.tentativas ?? 1) - 1);
      const base = { envioId, filaId: linha.id, atrasoSegundos: atraso, maxTentativas };

      switch (res.resultado) {
        case "aceite":
          await repo.registarResultado({ ...base, resultado: "aceite", wamid: res.wamid, retentavel: null, erroCodigo: null, erroDetalhe: null });
          c.aceites++;
          break;
        case "rejeitado": {
          const r = await repo.registarResultado({
            ...base, resultado: "rejeitado", wamid: null, retentavel: res.retentavel, erroCodigo: res.codigo, erroDetalhe: res.detalhe,
          });
          if (r === "nova_tentativa_agendada") c.novas_tentativas++;
          else c.rejeitadas++;
          log(`[wa-cloud] fila ${linha.id}: rejeitado ${res.codigo} (retentável=${res.retentavel})`);
          break;
        }
        case "invalido":
          await repo.registarResultado({
            ...base, resultado: "rejeitado", wamid: null, retentavel: false, erroCodigo: "validacao",
            erroDetalhe: res.erros.map((e) => `${e.campo}:${e.motivo}`).join(",").slice(0, 300),
          });
          c.rejeitadas++;
          break;
        default: {
          const codigo = res.resultado === "incerto" ? res.codigo : "resultado_inesperado";
          const detalhe = res.resultado === "incerto" ? res.detalhe : "";
          await repo.registarResultado({ ...base, resultado: "incerto", wamid: null, retentavel: null, erroCodigo: codigo, erroDetalhe: detalhe });
          c.incertas++;
          log(`[wa-cloud] fila ${linha.id}: resultado incerto (${codigo}) — não será repetido automaticamente`);
        }
      }
    } catch (e) {
      // Uma reserva sem resultado fica 'reservado' e passa a 'desconhecido' quando
      // expira: nunca há reenvio automático de algo que pode ter sido aceite.
      c.erros_internos++;
      log(`[wa-cloud] fila ${linha.id}: erro interno ${sanitizar(String((e as Error)?.message ?? e))}${envioId ? " (reserva fica para expirar)" : ""}`);
    }
  }
  return c;
}

// ---------------------------------------------------------------------------
// Adaptador para o Supabase (service_role)
// ---------------------------------------------------------------------------

export type ClienteRpc = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export async function chamarRpc<T>(cliente: ClienteRpc, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await cliente.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

export function criarRepositorioSupabase(cliente: ClienteRpc): RepositorioWhatsappCloud {
  const chamar = <T>(fn: string, args: Record<string, unknown>) => chamarRpc<T>(cliente, fn, args);
  return {
    expirarReservas: (minutos) => chamar<number>("whatsapp_cloud_expirar_reservas", { p_minutos: minutos }),
    reivindicar: async (limite, maxTentativas) =>
      ((await chamar<LinhaFila[] | null>("reivindicar_whatsapp_cloud", { p_limite: limite, p_max_tentativas: maxTentativas })) ?? [])
        .map((l) => ({ id: l.id, tentativas: l.tentativas })),
    preparar: (filaId) => chamar<Preparado>("whatsapp_cloud_preparar", { p_fila_id: filaId }),
    reservar: (a) =>
      chamar<Reserva>("whatsapp_cloud_reservar", {
        p_fila_id: a.filaId, p_chave: a.chave, p_assinatura: a.assinatura, p_agendamento_id: a.agendamentoId,
        p_usuario_id: a.usuarioId, p_tipo: a.tipo, p_antecedencia: a.antecedencia, p_versao_marcacao: a.versaoMarcacao,
        p_telefone_hash: a.telefoneHash, p_telefone_mascarado: a.telefoneMascarado, p_template: a.template,
        p_idioma: a.idioma, p_phone_number_id: a.phoneNumberId,
      }),
    confirmarReserva: (envioId, filaId, telefoneHash) =>
      chamar<{ ok: boolean; motivo?: string }>("whatsapp_cloud_confirmar_reserva", {
        p_envio_id: envioId, p_fila_id: filaId, p_telefone_hash: telefoneHash,
      }),
    libertarReserva: async (envioId, filaId, motivo) => {
      await chamar<null>("whatsapp_cloud_libertar_reserva", { p_envio_id: envioId, p_fila_id: filaId, p_motivo: motivo });
    },
    adiar: async (filaId, minutos, motivo) => {
      await chamar<null>("whatsapp_cloud_adiar", { p_fila_id: filaId, p_minutos: minutos, p_motivo: motivo });
    },
    registarResultado: (a) =>
      chamar<string>("whatsapp_cloud_registar_resultado", {
        p_envio_id: a.envioId, p_fila_id: a.filaId, p_resultado: a.resultado, p_wamid: a.wamid,
        p_retentavel: a.retentavel, p_erro_codigo: a.erroCodigo, p_erro_detalhe: a.erroDetalhe,
        p_atraso_segundos: a.atrasoSegundos, p_max_tentativas: a.maxTentativas,
      }),
    cancelar: async (filaId, motivo) => {
      await chamar<null>("whatsapp_cloud_cancelar", { p_fila_id: filaId, p_motivo: motivo });
    },
  };
}
