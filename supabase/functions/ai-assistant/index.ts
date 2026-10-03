// Edge Function: ai-assistant
// Assistente de IA do painel: a profissional pergunta em linguagem natural
// sobre a própria agenda, faturamento e clientes, e o Claude responde usando
// "tool use" — chama as funções abaixo, que vão sempre buscar os dados pelo
// ID confirmado no token de acesso (nunca pelo user_id que vier no pedido,
// para uma conta nunca poder ler dados de outra).
//
// Secret necessário (Supabase → Edge Functions → Secrets): ANTHROPIC_API_KEY.
// Sem ele, a função responde com um erro claro em vez de tentar chamar a API.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const MODELO = "claude-sonnet-5";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_IDAS_AO_MODELO = 6; // limite de voltas do loop de tool use, para nunca ficar presa

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

// ---------- Ferramentas que o modelo pode chamar ----------

const FERRAMENTAS = [
  {
    name: "listar_agendamentos",
    description:
      "Lista os agendamentos da profissional entre duas datas (passados e futuros), com cliente, procedimento, data, hora e valor.",
    input_schema: {
      type: "object",
      properties: {
        data_inicio: { type: "string", description: "Data inicial, formato AAAA-MM-DD" },
        data_fim: { type: "string", description: "Data final (inclusive), formato AAAA-MM-DD" },
      },
      required: ["data_inicio", "data_fim"],
    },
  },
  {
    name: "ver_faturamento",
    description: "Devolve o total faturado (soma dos valores dos agendamentos) num mês específico.",
    input_schema: {
      type: "object",
      properties: {
        mes: { type: "integer", description: "Mês do ano, de 1 a 12" },
        ano: { type: "integer", description: "Ano com 4 dígitos, por exemplo 2026" },
      },
      required: ["mes", "ano"],
    },
  },
  {
    name: "listar_clientes",
    description: "Lista as clientes registadas pela profissional (nome, telefone e email).",
    input_schema: { type: "object", properties: {} },
  },
];

/** Vai buscar o número ou texto de uma linha (a tabela guarda valores como texto em alguns casos antigos). */
function paraNumero(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

async function listarAgendamentos(uid: string, input: { data_inicio?: string; data_fim?: string }) {
  const { data_inicio, data_fim } = input;
  if (!data_inicio || !data_fim) return { erro: "Faltam data_inicio ou data_fim." };

  const { data, error } = await admin
    .from("agendamentos")
    .select("data, hora, cliente, procedimento, valor, preco")
    .eq("usuario_id", uid)
    .gte("data", data_inicio)
    .lte("data", data_fim)
    .order("data", { ascending: true })
    .limit(200);

  if (error) return { erro: error.message };
  return {
    total: data?.length ?? 0,
    agendamentos: (data ?? []).map((a) => ({
      data: a.data,
      hora: a.hora,
      cliente: a.cliente || "Cliente",
      procedimento: a.procedimento || "Sem procedimento",
      valor: paraNumero(a.valor ?? a.preco ?? 0),
    })),
  };
}

async function verFaturamento(uid: string, input: { mes?: number; ano?: number }) {
  const { mes, ano } = input;
  if (!mes || !ano || mes < 1 || mes > 12) return { erro: "mes (1-12) e ano são obrigatórios." };

  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const fimData = new Date(ano, mes, 0); // último dia do mês
  const fim = fimData.toISOString().slice(0, 10);

  const { data, error } = await admin
    .from("agendamentos")
    .select("valor, preco")
    .eq("usuario_id", uid)
    .gte("data", inicio)
    .lte("data", fim);

  if (error) return { erro: error.message };
  const total = (data ?? []).reduce((soma, a) => soma + paraNumero(a.valor ?? a.preco ?? 0), 0);
  return { mes, ano, total_faturado: Math.round(total * 100) / 100, numero_atendimentos: data?.length ?? 0 };
}

async function listarClientes(uid: string) {
  const { data, error } = await admin
    .from("clientes")
    .select("nome, telefone, email")
    .eq("usuario_id", uid)
    .order("nome", { ascending: true })
    .limit(300);

  if (error) return { erro: error.message };
  return { total: data?.length ?? 0, clientes: data ?? [] };
}

async function executarFerramenta(uid: string, nome: string, input: Record<string, unknown>) {
  try {
    switch (nome) {
      case "listar_agendamentos":
        return await listarAgendamentos(uid, input as { data_inicio?: string; data_fim?: string });
      case "ver_faturamento":
        return await verFaturamento(uid, input as { mes?: number; ano?: number });
      case "listar_clientes":
        return await listarClientes(uid);
      default:
        return { erro: `Ferramenta desconhecida: ${nome}` };
    }
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) };
  }
}

// ---------- Chamada à API da Anthropic, com o loop de tool use ----------

const SYSTEM_PROMPT = `És o assistente do EstetiCalcHub, uma aplicação de gestão para profissionais de estética em Portugal.
Respondes sempre em português de Portugal, de forma breve e direta.
Usa as ferramentas disponíveis para consultar os dados reais da conta da profissional — nunca inventes números.
Se não tiveres dados suficientes para responder, diz isso claramente em vez de supor.
Os valores monetários são em euros. A data de hoje é ${new Date().toISOString().slice(0, 10)}.`;

type BlocoConteudo = Record<string, unknown>;

async function chamarAnthropic(mensagens: BlocoConteudo[]) {
  const resp = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: FERRAMENTAS,
      messages: mensagens,
    }),
  });

  if (!resp.ok) {
    const texto = await resp.text();
    throw new Error(`Anthropic API (${resp.status}): ${texto}`);
  }
  return await resp.json();
}

async function responderMensagem(uid: string, mensagemUtilizadora: string): Promise<string> {
  const mensagens: BlocoConteudo[] = [{ role: "user", content: mensagemUtilizadora }];

  for (let volta = 0; volta < MAX_IDAS_AO_MODELO; volta++) {
    const resultado = await chamarAnthropic(mensagens);
    const blocos: BlocoConteudo[] = resultado.content ?? [];

    if (resultado.stop_reason !== "tool_use") {
      // Resposta final: junta todos os blocos de texto.
      return blocos
        .filter((b) => b.type === "text")
        .map((b) => b.text as string)
        .join("\n")
        .trim() || "Não consegui gerar uma resposta.";
    }

    // Pede-se à profissional para esperar mais uma volta: executa cada tool_use
    // e devolve os resultados ao modelo como tool_result.
    mensagens.push({ role: "assistant", content: blocos });

    const resultadosFerramentas: BlocoConteudo[] = [];
    for (const bloco of blocos) {
      if (bloco.type !== "tool_use") continue;
      const saida = await executarFerramenta(
        uid,
        bloco.name as string,
        (bloco.input as Record<string, unknown>) ?? {}
      );
      resultadosFerramentas.push({
        type: "tool_result",
        tool_use_id: bloco.id,
        content: JSON.stringify(saida),
      });
    }
    mensagens.push({ role: "user", content: resultadosFerramentas });
  }

  return "A conversa ficou demasiado longa para eu conseguir responder agora. Tenta reformular a pergunta de forma mais simples.";
}

// ---------- Handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ erro: "Método não permitido." }, 405);

  if (!ANTHROPIC_API_KEY) {
    return resposta({ erro: "O assistente ainda não está configurado (falta o secret ANTHROPIC_API_KEY)." }, 503);
  }

  try {
    // Quem pergunta é sempre confirmado pelo token — o user_id do corpo do
    // pedido é ignorado para nunca se misturarem dados de contas diferentes.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return resposta({ erro: "Não autenticado." }, 401);

    const { data: { user }, error: erroUser } = await admin.auth.getUser(token);
    if (erroUser || !user) return resposta({ erro: "Não autenticado." }, 401);

    const corpo = await req.json().catch(() => ({}));
    const mensagem = typeof corpo.message === "string" ? corpo.message.trim() : "";
    if (!mensagem) return resposta({ erro: "Falta a mensagem." }, 400);
    if (mensagem.length > 2000) return resposta({ erro: "Mensagem demasiado longa." }, 400);

    const texto = await responderMensagem(user.id, mensagem);
    return resposta({ resposta: texto });
  } catch (e) {
    return resposta({ erro: `Erro inesperado: ${e instanceof Error ? e.message : String(e)}` }, 500);
  }
});
