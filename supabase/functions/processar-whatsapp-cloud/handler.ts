// Worker independente da WhatsApp Cloud API (não toca em super-action nem em processar-fila).
//
// Proteções:
//   * autenticação: cabeçalho x-cron-secret = WA_CRON_SECRET (comparação em tempo
//     constante). Segredo PRÓPRIO, diferente do CRON_SECRET do fluxo atual;
//   * interruptor: só corre com WA_CLOUD_WORKER_ATIVO=true;
//   * execução única: trinco na base de dados (whatsapp_cloud_execucoes) com prazo,
//     porque os trincos de sessão do Postgres não são fiáveis através do PostgREST;
//   * logs: só contagens, ids internos e números mascarados.

import { iguaisTempoConstante } from "../_shared/webhook-meta.ts";
import { ConfigWhatsappCloud, ErroConfiguracao } from "../_shared/whatsapp-cloud.ts";
import { Contagens, OpcoesProcessamento, RepositorioWhatsappCloud } from "../_shared/lembretes-whatsapp-cloud.ts";

export const NOME_EXECUCAO = "processar-whatsapp-cloud";

export type DepsWorker = {
  cronSecret: string;
  ativo: boolean;
  lerConfig: () => ConfigWhatsappCloud;
  hashTelefone: ((e164: string) => Promise<string>) | null;
  repo: RepositorioWhatsappCloud;
  adquirirExecucao: (dono: string, segundos: number) => Promise<boolean>;
  libertarExecucao: (dono: string) => Promise<void>;
  processar: (
    repo: RepositorioWhatsappCloud,
    config: ConfigWhatsappCloud,
    opcoes: OpcoesProcessamento,
  ) => Promise<Contagens>;
  opcoes?: Partial<OpcoesProcessamento>;
  log?: (msg: string) => void;
};

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
}

export function criarHandlerWorker(deps: DepsWorker) {
  const log = deps.log ?? ((m: string) => console.log(m));

  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);

    const recebido = req.headers.get("x-cron-secret") ?? "";
    if (!deps.cronSecret || deps.cronSecret.length < 24 || !iguaisTempoConstante(recebido, deps.cronSecret)) {
      return json({ erro: "não autorizado" }, 401);
    }

    if (!deps.ativo) return json({ estado: "desativado (WA_CLOUD_WORKER_ATIVO != true)" });

    let config: ConfigWhatsappCloud;
    try {
      config = deps.lerConfig();
    } catch (e) {
      if (e instanceof ErroConfiguracao) {
        log(`[wa-worker] configuração incompleta: ${e.emFalta.join(", ")}`);
        return json({ erro: "configuração incompleta", em_falta: e.emFalta }, 500);
      }
      throw e;
    }
    if (!deps.hashTelefone) return json({ erro: "configuração incompleta", em_falta: ["WA_TELEFONE_PEPPER"] }, 500);

    const dono = crypto.randomUUID();
    if (!(await deps.adquirirExecucao(dono, 120))) {
      log("[wa-worker] outra execução em curso — a sair");
      return json({ estado: "outra_execucao_em_curso" }, 200);
    }

    try {
      const contagens = await deps.processar(deps.repo, config, {
        ...deps.opcoes,
        hashTelefone: deps.hashTelefone,
        log,
      });
      log(`[wa-worker] ${JSON.stringify(contagens)}`);
      return json({ estado: "ok", contagens });
    } catch (e) {
      log(`[wa-worker] erro: ${String((e as Error)?.message ?? e).slice(0, 200)}`);
      return json({ erro: "falha no processamento" }, 500);
    } finally {
      await deps.libertarExecucao(dono).catch(() => {});
    }
  };
}
