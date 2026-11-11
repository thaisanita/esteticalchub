// Teste controlado da WhatsApp Cloud API — isolado da fila de produção.
//
// Garantias:
//   * exige sessão (JWT) de um utilizador cujo id está em WA_TEST_ADMIN_USER_IDS;
//   * a destinatária tem de estar em WA_TEST_DESTINATARIOS (lista fechada);
//   * só templates conhecidos, com parâmetros de exemplo fixos (sem texto livre);
//   * uma mensagem por pedido, com intervalo mínimo entre pedidos;
//   * DRY-RUN por omissão. Envio real só com WA_TEST_ENVIO_REAL_PERMITIDO=true
//     E {"confirmar_envio_real": true} no pedido;
//   * não lê nem escreve em fila_notificacoes nem em whatsapp_cloud_envios.

import { ConfigWhatsappCloud, enviarTemplate, ErroConfiguracao, ResultadoEnvio } from "../_shared/whatsapp-cloud.ts";
import { mascararTelefone, normalizarTelefone } from "../_shared/telefone.ts";

export const TEMPLATES_DE_TESTE: Record<string, { idioma: string; parametros: string[] }> = {
  // Template de exemplo que a Meta cria em todas as contas (sem parâmetros).
  hello_world: { idioma: "en_US", parametros: [] },
  // Só funciona depois de o template estar APROVADO na conta.
  lembrete_marcacao_24h: {
    idioma: "pt_PT",
    parametros: ["Ana", "Estúdio Exemplo", "12/11", "15:00", "Microblading"],
  },
};

const UUID_00 = "00000000-0000-4000-8000-000000000000";

export type DepsTeste = {
  obterUtilizador: (authorization: string) => Promise<{ id: string } | null>;
  lerConfig: () => ConfigWhatsappCloud;
  adminIds: string[];
  destinatarios: string[];        // E.164 já normalizados
  envioRealPermitido: boolean;
  enviar?: typeof enviarTemplate;
  intervaloMinimoMs?: number;
  agora?: () => number;
  log?: (msg: string) => void;
};

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
}

export function lerListaDestinatarios(valor: string | undefined): string[] {
  return (valor ?? "")
    .split(",")
    .map((s) => normalizarTelefone(s.trim()))
    .filter((r): r is { ok: true; e164: string } => r.ok)
    .map((r) => r.e164);
}

export function criarHandlerTeste(deps: DepsTeste) {
  const enviar = deps.enviar ?? enviarTemplate;
  const intervalo = deps.intervaloMinimoMs ?? 30_000;
  const agora = deps.agora ?? (() => Date.now());
  const log = deps.log ?? ((m: string) => console.log(m));
  const ultimoPedido = new Map<string, number>();

  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);

    const utilizador = await deps.obterUtilizador(req.headers.get("Authorization") ?? "");
    if (!utilizador) return json({ erro: "Não autenticado." }, 401);
    if (!deps.adminIds.includes(utilizador.id)) return json({ erro: "Sem permissão." }, 403);

    let corpo: { destinatario?: unknown; template?: unknown; confirmar_envio_real?: unknown };
    try {
      corpo = await req.json();
    } catch {
      return json({ erro: "JSON inválido." }, 400);
    }
    if (Array.isArray(corpo?.destinatario)) return json({ erro: "Só uma destinatária por pedido." }, 400);

    const tel = normalizarTelefone(typeof corpo?.destinatario === "string" ? corpo.destinatario : "");
    if (!tel.ok || !deps.destinatarios.includes(tel.e164)) {
      return json({ erro: "Destinatária não autorizada para testes." }, 403);
    }

    const nomeTemplate = typeof corpo?.template === "string" ? corpo.template : "hello_world";
    const tpl = TEMPLATES_DE_TESTE[nomeTemplate];
    if (!tpl) return json({ erro: "Template não permitido em testes." }, 400);

    const ultimo = ultimoPedido.get(utilizador.id);
    if (ultimo !== undefined && agora() - ultimo < intervalo) return json({ erro: "Aguarde antes de novo teste." }, 429);
    ultimoPedido.set(utilizador.id, agora());

    let config: ConfigWhatsappCloud;
    try {
      config = deps.lerConfig();
    } catch (e) {
      if (e instanceof ErroConfiguracao) return json({ erro: "Configuração incompleta.", em_falta: e.emFalta }, 500);
      throw e;
    }

    const envioReal = deps.envioRealPermitido && corpo?.confirmar_envio_real === true;
    const res: ResultadoEnvio & { telefoneMascarado?: string } = await enviar(
      config,
      {
        agendamentoId: UUID_00,
        usuarioId: utilizador.id,
        telefone: tel.e164,
        template: nomeTemplate,
        idioma: tpl.idioma,
        parametros: tpl.parametros,
        numeroParametrosEsperado: tpl.parametros.length,
      },
      { dryRun: !envioReal },
    );

    log(`[wa-teste] admin=${utilizador.id.slice(0, 8)} para=${mascararTelefone(tel.e164)} template=${nomeTemplate} modo=${envioReal ? "real" : "dry-run"} resultado=${res.resultado}`);

    return json({
      modo: envioReal ? "real" : "dry-run",
      destinatario: mascararTelefone(tel.e164),
      template: nomeTemplate,
      graph_api_version: config.graphApiVersion,
      resultado: res,
    });
  };
}
