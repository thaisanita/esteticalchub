// Cliente Supabase com a service_role key — só usado aqui no servidor do robô,
// nunca no navegador. Serve pra: (1) confirmar quem é o utilizador dono de um
// pedido (via o token dele) e (2) atualizar o status "conectado/desconectado"
// que aparece na tela de Configurações do site.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Faltam variáveis de ambiente: SUPABASE_URL, SUPABASE_ANON_KEY e/ou SUPABASE_SERVICE_ROLE_KEY. Ver README.md.'
  );
}

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Confirma que o token pertence a um utilizador real logado no site, e
 * devolve o id dele. Usa o próprio endpoint de auth do Supabase — o robô não
 * precisa de saber decifrar o token, só perguntar ao Supabase "de quem é?".
 */
export async function usuarioIdDoToken(token) {
  if (!token) return null;
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data?.id ?? null;
}

export async function atualizarStatusWhatsapp(usuarioId, status) {
  await supabaseAdmin
    .from('configuracoes_usuario')
    .upsert(
      {
        usuario_id: usuarioId,
        whatsapp_status: status,
        whatsapp_conectado_em: status === 'conectado' ? new Date().toISOString() : null,
      },
      { onConflict: 'usuario_id' }
    );
}
