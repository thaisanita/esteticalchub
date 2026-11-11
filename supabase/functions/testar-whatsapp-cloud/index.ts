// Edge Function: testar-whatsapp-cloud
// Teste manual e controlado da Cloud API. DRY-RUN por omissão.
// Ver handler.ts para as garantias de segurança e docs/WHATSAPP_CLOUD_API.md.
//
// Deploy (quando autorizado) — COM verificação de JWT:
//   supabase functions deploy testar-whatsapp-cloud

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { lerConfig } from "../_shared/whatsapp-cloud.ts";
import { criarHandlerTeste, lerListaDestinatarios } from "./handler.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(
  criarHandlerTeste({
    obterUtilizador: async (authorization) => {
      if (!authorization.startsWith("Bearer ")) return null;
      const cliente = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await cliente.auth.getUser();
      return error || !data?.user ? null : { id: data.user.id };
    },
    lerConfig: () => lerConfig(),
    adminIds: (Deno.env.get("WA_TEST_ADMIN_USER_IDS") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    destinatarios: lerListaDestinatarios(Deno.env.get("WA_TEST_DESTINATARIOS")),
    envioRealPermitido: Deno.env.get("WA_TEST_ENVIO_REAL_PERMITIDO") === "true",
  }),
);
