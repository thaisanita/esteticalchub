// Edge Function: stripe-checkout
// Cria uma sessão de Checkout do Stripe (modo "subscription") para a
// profissional passar do plano Grátis para o Pro. Reaproveita o
// stripe_customer_id já guardado em profiles, ou cria um customer novo.
//
// Secrets necessários: STRIPE_SECRET_KEY.
// Verify JWT pode ficar LIGADO para esta função (ao contrário do webhook) —
// quem chama é sempre a própria utilizadora logada.

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
    // Quem pede é sempre confirmado pelo token — o user_id do corpo do
    // pedido é ignorado (aqui só serve de referência, não é usado para nada).
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return resposta({ erro: "Não autenticado." }, 401);

    const { data: { user }, error: erroUser } = await admin.auth.getUser(token);
    if (erroUser || !user) return resposta({ erro: "Não autenticado." }, 401);

    const corpo = await req.json().catch(() => ({}));
    const priceId = typeof corpo.price_id === "string" ? corpo.price_id : "";
    if (!priceId) return resposta({ erro: "Falta price_id." }, 400);

    const { data: perfil } = await admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    let customerId = perfil?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { usuario_id: user.id },
      });
      customerId = customer.id;
      await admin.from("profiles").upsert({ id: user.id, stripe_customer_id: customerId }, { onConflict: "id" });
    }

    const sessao = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/planos?sucesso=true`,
      cancel_url: `${APP_URL}/planos`,
      client_reference_id: user.id,
      subscription_data: { metadata: { usuario_id: user.id } },
    });

    return resposta({ url: sessao.url });
  } catch (e) {
    return resposta({ erro: `Erro inesperado: ${e instanceof Error ? e.message : String(e)}` }, 500);
  }
});
