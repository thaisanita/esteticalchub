// Edge Function: meta-ads-insights
// Lê o gasto e os resultados das campanhas de Meta Ads (Facebook/Instagram)
// das contas de anúncios que a profissional ligou em meta_ads_contas.
//
// Secrets necessários: META_ACCESS_TOKEN (token de sistema com permissão ads_read).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");
const META_API_VERSAO = "v21.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

interface AcaoMeta {
  action_type: string;
  value: string;
}

interface LinhaInsightMeta {
  campaign_id: string;
  campaign_name: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: AcaoMeta[];
}

// Tipos de ação que normalmente correspondem a um "resultado" de negócio
// (lead, mensagem iniciada, conversão) em vez de cliques genéricos.
const TIPOS_ACAO_RESULTADO = new Set([
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.messaging_first_reply",
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
]);

function resumirCampanha(linha: LinhaInsightMeta, contaNome: string) {
  const acoes = linha.actions ?? [];
  const resultados = acoes
    .filter((a) => TIPOS_ACAO_RESULTADO.has(a.action_type))
    .reduce((soma, a) => soma + Number(a.value || 0), 0);
  const gasto = Number(linha.spend || 0);

  return {
    conta: contaNome,
    campanha: linha.campaign_name,
    gasto,
    impressoes: Number(linha.impressions || 0),
    cliques: Number(linha.clicks || 0),
    resultados,
    custoPorResultado: resultados > 0 ? gasto / resultados : null,
    acoesDetalhe: acoes.map((a) => ({ tipo: a.action_type, valor: Number(a.value || 0) })),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ erro: "Método não permitido." }, 405);

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return resposta({ erro: "Não autenticado." }, 401);

    const { data: { user }, error: erroUser } = await admin.auth.getUser(token);
    if (erroUser || !user) return resposta({ erro: "Não autenticado." }, 401);

    if (!META_ACCESS_TOKEN) {
      return resposta({ erro: "O acesso à Meta ainda não está configurado (falta META_ACCESS_TOKEN)." }, 400);
    }

    const corpo = await req.json().catch(() => ({}));
    const periodo = corpo.periodo === "7d" ? "last_7d" : "last_30d";

    const { data: contas, error: erroContas } = await admin
      .from("meta_ads_contas")
      .select("ad_account_id, nome")
      .eq("user_id", user.id);

    if (erroContas) return resposta({ erro: "Erro ao procurar contas ligadas." }, 500);
    if (!contas || contas.length === 0) {
      return resposta({ campanhas: [], aviso: "Nenhuma conta de anúncios ligada ainda." });
    }

    const campanhas = [];
    const avisos: string[] = [];

    for (const conta of contas) {
      const url =
        `https://graph.facebook.com/${META_API_VERSAO}/act_${conta.ad_account_id}/insights` +
        `?level=campaign&date_preset=${periodo}` +
        `&fields=campaign_id,campaign_name,spend,impressions,clicks,actions` +
        `&limit=100&access_token=${META_ACCESS_TOKEN}`;

      const resp = await fetch(url);
      const json = await resp.json();

      if (!resp.ok) {
        avisos.push(
          `Conta ${conta.nome || conta.ad_account_id}: ${json?.error?.message || "erro ao consultar a Meta."}`
        );
        continue;
      }

      const linhas: LinhaInsightMeta[] = json.data || [];
      for (const linha of linhas) {
        campanhas.push(resumirCampanha(linha, conta.nome || conta.ad_account_id));
      }
    }

    campanhas.sort((a, b) => b.gasto - a.gasto);

    return resposta({ campanhas, avisos: avisos.length ? avisos : undefined });
  } catch (e) {
    return resposta({ erro: `Erro inesperado: ${e instanceof Error ? e.message : String(e)}` }, 500);
  }
});
