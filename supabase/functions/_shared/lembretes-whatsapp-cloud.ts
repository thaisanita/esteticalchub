// Núcleo do envio de lembretes de 1 dia pela WhatsApp Cloud API.
//
// Fluxo por linha (cada passo validado na base de dados, nunca na fila):
//   0. expirar reservas órfãs        -> estado 'desconhecido' (não repete)
//   1. reivindicar_whatsapp_cloud     -> só canal 'whatsapp_cloud' (disjunto do Baileys)
//   2. whatsapp_cloud_preparar        -> profissional, marcação, cliente, consentimento,
//                                        telefone e janela temporal lidos das tabelas
//   3. normalizar telefone + chave de idempotência (marcação + versão + destino + template)
//   4. whatsapp_cloud_reservar        -> só uma reserva por chave avança
//   5. pedido à Meta
//   6. whatsapp_cloud_registar_resultado (aceite / rejeitado / incerto)
//
// Este módulo NÃO está ligado a nenhum cron nesta fase (ver docs/WHATSAPP_CLOUD_API.md).

import {
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

export type Preparado =
  | { ok: false; motivo: string }
  | {
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

export type Reserva = { reservado: true; envio_id: string } | { reservado: false; estado_existente: string | null };

export interface RepositorioWhatsappCloud {
  expirarReservas(minutos: number): Promise<number>;
  reivindicar(limite: number, maxTentativas: number): Promise<LinhaFila[]>;
  preparar(filaId: string): Promise<Preparado>;
  reservar(args: {
    filaId: string; chave: string; agendamentoId: string; usuarioId: string; tipo: string;
    antecedencia: string; versaoMarcacao: string; telefoneMascarado: string; template: string; idioma: string;
  }): Promise<Reserva>;
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
  erros_internos: number;
  reservas_expiradas: number;
};

export type OpcoesProcessamento = {
  limite?: number;
  maxTentativas?: number;
  atrasoBaseSegundos?: number;
  minutosExpiracaoReserva?: number;
  enviar?: Enviador;
  log?: (msg: string) => void;
};

export async function processarLembretesWhatsappCloud(
  repo: RepositorioWhatsappCloud,
  config: ConfigWhatsappCloud,
  opcoes: OpcoesProcessamento = {},
): Promise<Contagens> {
  const limite = opcoes.limite ?? 20;
  const maxTentativas = opcoes.maxTentativas ?? 3;
  const atrasoBase = opcoes.atrasoBaseSegundos ?? 600;
  const enviar = opcoes.enviar ?? ((c, p) => enviarTemplate(c, p));
  const log = opcoes.log ?? ((m) => console.log(m));

  const c: Contagens = {
    reivindicadas: 0, aceites: 0, rejeitadas: 0, novas_tentativas: 0, incertas: 0,
    canceladas: 0, duplicadas: 0, erros_internos: 0, reservas_expiradas: 0,
  };

  c.reservas_expiradas = await repo.expirarReservas(opcoes.minutosExpiracaoReserva ?? 10);
  const linhas = await repo.reivindicar(limite, maxTentativas);
  c.reivindicadas = linhas.length;

  for (const linha of linhas) {
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

      const chave = await chaveIdempotencia({
        agendamentoId: prep.agendamento_id,
        tipo: prep.tipo,
        antecedencia: prep.antecedencia,
        versaoMarcacao: prep.versao_marcacao,
        e164: tel.e164,
        template: TEMPLATE_LEMBRETE_24H.nome,
        idioma: TEMPLATE_LEMBRETE_24H.idioma,
      });

      const reserva = await repo.reservar({
        filaId: linha.id,
        chave,
        agendamentoId: prep.agendamento_id,
        usuarioId: prep.usuario_id,
        tipo: prep.tipo,
        antecedencia: prep.antecedencia,
        versaoMarcacao: prep.versao_marcacao,
        telefoneMascarado: mascararTelefone(tel.e164),
        template: TEMPLATE_LEMBRETE_24H.nome,
        idioma: TEMPLATE_LEMBRETE_24H.idioma,
      });
      if (!reserva.reservado) {
        await repo.cancelar(linha.id, `duplicado:${reserva.estado_existente ?? "?"}`);
        c.duplicadas++;
        continue;
      }
      envioId = reserva.envio_id;

      const res = await enviar(config, {
        agendamentoId: prep.agendamento_id,
        usuarioId: prep.usuario_id,
        telefone: tel.e164,
        template: TEMPLATE_LEMBRETE_24H.nome,
        idioma: TEMPLATE_LEMBRETE_24H.idioma,
        parametros: parametrosLembrete24h({
          clienteNome: prep.cliente_nome,
          profissionalNome: prep.profissional_nome,
          data: prep.data,
          hora: prep.hora,
          procedimento: prep.procedimento,
        }),
        numeroParametrosEsperado: TEMPLATE_LEMBRETE_24H.numeroParametros,
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
            ...base, resultado: "rejeitado", wamid: null, retentavel: res.retentavel,
            erroCodigo: res.codigo, erroDetalhe: res.detalhe,
          });
          if (r === "nova_tentativa_agendada") c.novas_tentativas++;
          else c.rejeitadas++;
          log(`[wa-cloud] fila ${linha.id}: rejeitado ${res.codigo} (retentável=${res.retentavel})`);
          break;
        }
        case "invalido":
          // Nada saiu do servidor: rejeição confirmada, não retentável.
          await repo.registarResultado({
            ...base, resultado: "rejeitado", wamid: null, retentavel: false,
            erroCodigo: "validacao", erroDetalhe: res.erros.map((e) => `${e.campo}:${e.motivo}`).join(",").slice(0, 300),
          });
          c.rejeitadas++;
          break;
        case "incerto":
        default: {
          const codigo = res.resultado === "incerto" ? res.codigo : "resultado_inesperado";
          const detalhe = res.resultado === "incerto" ? res.detalhe : "";
          await repo.registarResultado({
            ...base, resultado: "incerto", wamid: null, retentavel: null, erroCodigo: codigo, erroDetalhe: detalhe,
          });
          c.incertas++;
          log(`[wa-cloud] fila ${linha.id}: resultado incerto (${codigo}) — não será repetido automaticamente`);
        }
      }
    } catch (e) {
      // Erro interno (ex.: falha ao gravar o resultado). Se já havia reserva, ela
      // fica 'reservado' e passa a 'desconhecido' na próxima expiração: nunca
      // há reenvio automático de algo que pode ter sido aceite.
      c.erros_internos++;
      log(`[wa-cloud] fila ${linha.id}: erro interno ${sanitizar(String((e as Error)?.message ?? e))}${envioId ? " (reserva fica para expirar)" : ""}`);
    }
  }
  return c;
}

// ---------------------------------------------------------------------------
// Adaptador para o Supabase (service_role)
// ---------------------------------------------------------------------------

type ClienteRpc = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

async function chamar<T>(cliente: ClienteRpc, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await cliente.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

export function criarRepositorioSupabase(cliente: ClienteRpc): RepositorioWhatsappCloud {
  return {
    expirarReservas: (minutos) => chamar<number>(cliente, "whatsapp_cloud_expirar_reservas", { p_minutos: minutos }),
    reivindicar: async (limite, maxTentativas) =>
      ((await chamar<LinhaFila[] | null>(cliente, "reivindicar_whatsapp_cloud", {
        p_limite: limite,
        p_max_tentativas: maxTentativas,
      })) ?? []).map((l) => ({ id: l.id, tentativas: l.tentativas })),
    preparar: (filaId) => chamar<Preparado>(cliente, "whatsapp_cloud_preparar", { p_fila_id: filaId }),
    reservar: (a) =>
      chamar<Reserva>(cliente, "whatsapp_cloud_reservar", {
        p_fila_id: a.filaId, p_chave: a.chave, p_agendamento_id: a.agendamentoId, p_usuario_id: a.usuarioId,
        p_tipo: a.tipo, p_antecedencia: a.antecedencia, p_versao_marcacao: a.versaoMarcacao,
        p_telefone_mascarado: a.telefoneMascarado, p_template: a.template, p_idioma: a.idioma,
      }),
    registarResultado: (a) =>
      chamar<string>(cliente, "whatsapp_cloud_registar_resultado", {
        p_envio_id: a.envioId, p_fila_id: a.filaId, p_resultado: a.resultado, p_wamid: a.wamid,
        p_retentavel: a.retentavel, p_erro_codigo: a.erroCodigo, p_erro_detalhe: a.erroDetalhe,
        p_atraso_segundos: a.atrasoSegundos, p_max_tentativas: a.maxTentativas,
      }),
    cancelar: async (filaId, motivo) => {
      await chamar<null>(cliente, "whatsapp_cloud_cancelar", { p_fila_id: filaId, p_motivo: motivo });
    },
  };
}
