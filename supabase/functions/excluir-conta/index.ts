// ⚠️ NÃO PUBLICAR / DESATIVADA: eliminação de conta suspensa até se perceber porque
// apareceu perda de dados noutras contas. Ver conversa de 20/09/2026.

// Edge Function: excluir-conta
// Direito ao apagamento (RGPD, art. 17.º): a própria profissional elimina a
// sua conta e todos os dados associados, a partir de Configurações.
//
// Publicada no Supabase com o nome "rapid-worker" (o painel gera o nome).
// A própria função valida quem pede (o token da pessoa é confirmado no Auth) e
// só apaga a conta de quem fez o pedido, por isso o "Verify JWT" do gateway
// pode ficar desligado (recomendação do Supabase: validar no código).
//
// Nunca pára a meio: tenta apagar tudo e no fim tenta apagar a conta de
// acesso, devolvendo sempre um JSON com o que correu mal (se algo falhar).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WHATSAPP_BOT_URL = Deno.env.get("WHATSAPP_BOT_URL");
const BOT_SECRET = Deno.env.get("BOT_SECRET");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Ordem importa: primeiro o que depende de outras tabelas.
const TABELAS_POR_USUARIO = [
  "cartoes_kanban",
  "listas_kanban",
  "quadros_kanban",
  "fila_notificacoes",
  "produto_usos",
  "fechamentos",
  "se_custos",
  "prontuarios",
  "agendamentos",
  "clientes",
  "custos_fixos",
  "produtos",
  "metas_mensais",
  "paginas_publicas",
  "procedimentos",
  "configuracoes_usuario",
];

const BUCKETS = ["prontuarios", "paginas-publicas"];

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/** Apaga tudo o que estiver debaixo de <bucket>/<prefixo>/, incluindo subpastas. */
async function apagarPasta(bucket: string, prefixo: string, falhas: string[]) {
  const { data, error } = await admin.storage.from(bucket).list(prefixo, { limit: 1000 });
  if (error) {
    // bucket inexistente = nada para apagar; qualquer outro erro conta como falha
    if (!/not found|does not exist/i.test(error.message)) falhas.push(`${bucket} (listar): ${error.message}`);
    return;
  }

  const ficheiros: string[] = [];
  for (const item of data ?? []) {
    const caminho = `${prefixo}/${item.name}`;
    if (item.id) ficheiros.push(caminho);
    else await apagarPasta(bucket, caminho, falhas); // subpasta
  }
  if (ficheiros.length) {
    const { error: erroRemover } = await admin.storage.from(bucket).remove(ficheiros);
    if (erroRemover) falhas.push(`${bucket} (apagar): ${erroRemover.message}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ erro: "Método não permitido." }, 405);

  try {
    // 1. Quem está a pedir? O token da própria pessoa é confirmado no Auth.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return resposta({ erro: "Não autenticado." }, 401);

    const { data: { user }, error: erroUser } = await admin.auth.getUser(token);
    if (erroUser || !user) return resposta({ erro: "Não autenticado." }, 401);

    const uid = user.id;
    const falhas: string[] = [];

    // 2. Sessão de WhatsApp guardada no robô (se estiver ligado)
    if (WHATSAPP_BOT_URL && BOT_SECRET) {
      try {
        await fetch(`${WHATSAPP_BOT_URL}/sessao/apagar`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-bot-secret": BOT_SECRET },
          body: JSON.stringify({ usuario_id: uid }),
        });
      } catch (e) {
        falhas.push(`whatsapp: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 3. Ficheiros (fotos, contratos, fotos da página pública). Se sobrar algum,
    // o Supabase não deixa apagar a conta — por isso as falhas são registadas.
    for (const bucket of BUCKETS) {
      try {
        await apagarPasta(bucket, uid, falhas);
      } catch (e) {
        falhas.push(`${bucket}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 4. Linhas de dados. Tabelas que não existam ou não tenham a coluna são ignoradas.
    for (const tabela of TABELAS_POR_USUARIO) {
      const { error } = await admin.from(tabela).delete().eq("usuario_id", uid);
      if (error && !/does not exist|schema cache|column/i.test(error.message)) {
        falhas.push(`${tabela}: ${error.message}`);
      }
    }
    await admin.from("profiles").delete().eq("id", uid);

    // 5. A conta de acesso — tenta SEMPRE, mesmo que algo acima tenha falhado
    // (deixar a conta viva sem dados era pior do que tentar apagá-la).
    const { error: erroDelete } = await admin.auth.admin.deleteUser(uid);
    if (erroDelete) {
      return resposta({ erro: `Não foi possível apagar a conta de acesso: ${erroDelete.message}`, falhas }, 500);
    }

    return resposta({ ok: true, avisos: falhas });
  } catch (e) {
    return resposta({ erro: `Erro inesperado: ${e instanceof Error ? e.message : String(e)}` }, 500);
  }
});
