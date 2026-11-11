// Edge Function: whatsapp-webhook
// Recebe da Meta os estados das mensagens e os pedidos de paragem ("PARAR").
//
// Deploy (quando autorizado):
//   supabase functions deploy whatsapp-webhook --no-verify-jwt
// Sem JWT de utilizador: a autenticação é a assinatura X-Hub-Signature-256
// (HMAC-SHA256 do corpo bruto com WA_APP_SECRET), que nunca é desativada.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashTelefone } from "../_shared/whatsapp-cloud.ts";
import { criarHandlerWebhook } from "./handler.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const pepper = Deno.env.get("WA_TELEFONE_PEPPER") ?? "";

async function rpc(fn: string, args: Record<string, unknown>): Promise<string> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return String(data);
}

Deno.serve(
  criarHandlerWebhook({
    appSecret: Deno.env.get("WA_APP_SECRET") ?? "",
    verifyToken: Deno.env.get("WA_VERIFY_TOKEN") ?? "",
    hashTelefone: pepper.length >= 32 ? (e164) => hashTelefone(e164, pepper) : null,
    registarEvento: (ev) =>
      rpc("whatsapp_cloud_registar_evento", {
        p_wamid: ev.wamid,
        p_estado: ev.estado,
        p_ocorrido_em: ev.ocorridoEm,
        p_erro_codigo: ev.erroCodigo,
      }),
    registarOptout: (telefoneHash, palavra, wamid) =>
      rpc("whatsapp_cloud_registar_optout", { p_telefone_hash: telefoneHash, p_palavra: palavra, p_wamid: wamid }),
  }),
);
