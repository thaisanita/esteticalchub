// Edge Function: stripe-portal
// Abre o Portal do Cliente do Stripe, para a profissional Pro gerir a sua
// subscrição (cartão, faturas, cancelamento) sem precisar de nos escrever.
//
// Secrets necessários: STRIPE_SECRET_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "https://esteticalchub.pages.dev";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ erro: "Método não permitido." }, 405);

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return resposta({ erro: "Não autenticado." }, 401);

    const { data: { user }, error: erroUser } = await admin.auth.getUser(token);
    if (erroUser || !user) return resposta({ erro: "Não autenticado." }, 401);

    const { data: perfil } = await admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!perfil?.stripe_customer_id) {
      return resposta({ erro: "Esta conta ainda não tem uma subscrição no Stripe." }, 400);
    }

    const sessao = await stripe.billingPortal.sessions.create({
      customer: perfil.stripe_customer_id,
      return_url: `${APP_URL}/planos`,
    });

    return resposta({ url: sessao.url });
  } catch (e) {
    return resposta({ erro: `Erro inesperado: ${e instanceof Error ? e.message : String(e)}` }, 500);
  }
});
