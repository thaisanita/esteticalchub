// Edge Function: processar-whatsapp-cloud
// Envia os lembretes de 1 dia (canal 'whatsapp_cloud') pela WhatsApp Cloud API.
// Chamada pelo seu PRÓPRIO cron (supabase/cron/processar_whatsapp_cloud.sql),
// criado DESATIVADO. Ver docs/WHATSAPP_CLOUD_API.md.
//
// Deploy (quando autorizado) — sem JWT de utilizador; autentica por WA_CRON_SECRET:
//   supabase functions deploy processar-whatsapp-cloud --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashTelefone, lerConfig } from "../_shared/whatsapp-cloud.ts";
import {
  chamarRpc,
  criarRepositorioSupabase,
  processarLembretesWhatsappCloud,
} from "../_shared/lembretes-whatsapp-cloud.ts";
import { criarHandlerWorker, NOME_EXECUCAO } from "./handler.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const pepper = Deno.env.get("WA_TELEFONE_PEPPER") ?? "";
const numeroOuPadrao = (nome: string, padrao: number) => {
  const v = Number(Deno.env.get(nome));
  return Number.isFinite(v) && v > 0 ? v : padrao;
};

Deno.serve(
  criarHandlerWorker({
    cronSecret: Deno.env.get("WA_CRON_SECRET") ?? "",
    ativo: Deno.env.get("WA_CLOUD_WORKER_ATIVO") === "true",
    lerConfig: () => lerConfig(),
    hashTelefone: pepper.length >= 32 ? (e164) => hashTelefone(e164, pepper) : null,
    repo: criarRepositorioSupabase(admin),
    adquirirExecucao: (dono, segundos) =>
      chamarRpc<boolean>(admin, "whatsapp_cloud_adquirir_execucao", { p_nome: NOME_EXECUCAO, p_dono: dono, p_segundos: segundos }),
    libertarExecucao: async (dono) => {
      await chamarRpc<null>(admin, "whatsapp_cloud_libertar_execucao", { p_nome: NOME_EXECUCAO, p_dono: dono });
    },
    processar: processarLembretesWhatsappCloud,
    opcoes: {
      limite: numeroOuPadrao("WA_LOTE", 20),
      prazoMs: numeroOuPadrao("WA_PRAZO_MS", 40_000),
    },
  }),
);
