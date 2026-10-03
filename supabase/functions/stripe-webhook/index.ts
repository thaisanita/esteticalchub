// Edge Function: stripe-webhook
// Recebe os eventos do Stripe e mantém profiles.plan sincronizado.
//
// IMPORTANTE: esta função NÃO verifica um token de utilizadora (o Stripe não
// tem sessão no Supabase) — em vez disso, verifica a ASSINATURA do pedido
// com STRIPE_WEBHOOK_SECRET. Por isso o "Verify JWT" do gateway tem de ficar
// DESLIGADO para esta função específica, senão o Supabase rejeita o pedido
// do Stripe antes de ele chegar aqui.
//
// Configurar no Stripe Dashboard → Developers → Webhooks → Add endpoint,
// com o URL desta função e, no mínimo, os eventos:
//   checkout.session.completed, customer.subscription.updated,
//   customer.subscription.deleted, invoice.payment_failed
// O Stripe dá-te o "Signing secret" (whsec_...) nesse momento — é o valor do
// secret STRIPE_WEBHOOK_SECRET.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

async function definirPlano(
  usuarioId: string,
  dados: { plan: string; stripe_subscription_id?: string | null; plan_expires_at?: string | null }
) {
  const { error } = await admin.from("profiles").upsert({ id: usuarioId, ...dados }, { onConflict: "id" });
  if (error) console.error(`Falha ao atualizar profiles de ${usuarioId}:`, error.message);
}

/** Quando o evento não traz o usuario_id na metadata, vai buscá-lo pelo customer do Stripe. */
async function usuarioIdPeloCustomer(customerId: string): Promise<string | null> {
  const { data } = await admin.from("profiles").select("id").eq("stripe_customer_id", customerId).maybeSingle();
  return data?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Método não permitido.", { status: 405 });

  const assinatura = req.headers.get("stripe-signature");
  if (!assinatura) return new Response("Falta a assinatura.", { status: 400 });

  // O corpo tem de ser lido em bruto (texto), antes de qualquer JSON.parse,
  // porque a verificação da assinatura é feita sobre os bytes originais.
  const corpoCru = await req.text();

  let evento: Stripe.Event;
  try {
    evento = await stripe.webhooks.constructEventAsync(corpoCru, assinatura, STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return new Response(`Assinatura inválida: ${e instanceof Error ? e.message : String(e)}`, { status: 400 });
  }

  try {
    switch (evento.type) {
      case "checkout.session.completed": {
        const sessao = evento.data.object as Stripe.Checkout.Session;
        const usuarioId =
          sessao.client_reference_id ||
          (sessao.customer ? await usuarioIdPeloCustomer(String(sessao.customer)) : null);

        if (usuarioId) {
          const subscriptionId =
            typeof sessao.subscription === "string" ? sessao.subscription : sessao.subscription?.id ?? null;
          await definirPlano(usuarioId, { plan: "pro", stripe_subscription_id: subscriptionId });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscricao = evento.data.object as Stripe.Subscription;
        const usuarioId =
          subscricao.metadata?.usuario_id || (await usuarioIdPeloCustomer(String(subscricao.customer)));

        if (usuarioId) {
          const emPeriodoValido = subscricao.status === "active" || subscricao.status === "trialing";
          await definirPlano(usuarioId, {
            plan: emPeriodoValido ? "pro" : "free",
            plan_expires_at: new Date(subscricao.current_period_end * 1000).toISOString(),
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscricao = evento.data.object as Stripe.Subscription;
        const usuarioId =
          subscricao.metadata?.usuario_id || (await usuarioIdPeloCustomer(String(subscricao.customer)));

        if (usuarioId) {
          await definirPlano(usuarioId, { plan: "free", stripe_subscription_id: null, plan_expires_at: null });
        }
        break;
      }

      case "invoice.payment_failed": {
        // Ponto de extensão: avisar a profissional por email que o pagamento
        // falhou (ex.: via Resend, com o mesmo padrão já usado em
        // supabase/functions/processar-fila — ver NOTIFICACOES_AUTOMATICAS.md).
        // Não implementado agora, de propósito.
        break;
      }

      default:
        break;
    }
  } catch (e) {
    // Se falhar a aplicar o evento, devolve erro para o Stripe tentar
    // reenviar (ele reenvia com retry automático durante alguns dias).
    console.error("Erro ao processar evento Stripe:", e);
    return new Response("Erro ao processar.", { status: 500 });
  }

  return new Response("ok", { status: 200 });
});
