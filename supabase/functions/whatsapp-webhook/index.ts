// Edge Function: whatsapp-webhook
// Recebe os estados das mensagens (sent / delivered / read / failed) da Meta.
//
// Deploy (quando autorizado):
//   supabase functions deploy whatsapp-webhook --no-verify-jwt
// Sem JWT de utilizador: a autenticação é a assinatura X-Hub-Signature-256
// (HMAC-SHA256 do corpo bruto com WA_APP_SECRET), que nunca é desativada.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { criarHandlerWebhook } from "./handler.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(
  criarHandlerWebhook({
    appSecret: Deno.env.get("WA_APP_SECRET") ?? "",
    verifyToken: Deno.env.get("WA_VERIFY_TOKEN") ?? "",
    registarEvento: async (ev) => {
      const { data, error } = await admin.rpc("whatsapp_cloud_registar_evento", {
        p_wamid: ev.wamid,
        p_estado: ev.estado,
        p_ocorrido_em: ev.ocorridoEm,
        p_erro_codigo: ev.erroCodigo,
      });
      if (error) throw new Error(error.message);
      return String(data);
    },
  }),
);
