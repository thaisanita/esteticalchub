import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const MAX_TENTATIVAS = 5;

// Só repetimos pedidos que são seguros de repetir: leituras (GET/HEAD) e a
// renovação do token de sessão. Escritas (INSERT, UPDATE, DELETE, RPC) não são
// repetidas, porque se o pedido tiver chegado ao servidor antes de a ligação
// cair, repeti-lo duplicaria dados.
function podeRepetir(url, metodo) {
  return metodo === 'GET' || metodo === 'HEAD' || url.includes('/auth/v1/token');
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * fetch com repetição e intervalo crescente (1s, 2s, 4s, 8s...) só para falhas
 * de rede (sem ligação). Respostas HTTP, mesmo de erro, não são repetidas aqui.
 * Avisa a interface com os eventos "rede:falha" e "rede:ok" (ver BannerRede).
 */
async function fetchComRepeticao(url, opcoes = {}) {
  const metodo = String(opcoes.method || 'GET').toUpperCase();
  const endereco = String(url);
  const repetivel = podeRepetir(endereco, metodo);
  let tentativa = 0;

  for (;;) {
    try {
      const resposta = await fetch(url, opcoes);
      if (tentativa > 0) window.dispatchEvent(new Event('rede:ok'));
      return resposta;
    } catch (erro) {
      const cancelado = erro?.name === 'AbortError';
      const esgotou = tentativa >= MAX_TENTATIVAS - 1;
      if (cancelado || !repetivel || esgotou) throw erro;

      tentativa += 1;
      window.dispatchEvent(new Event('rede:falha'));
      await esperar(Math.min(1000 * 2 ** (tentativa - 1), 16000));
    }
  }
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    fetch: fetchComRepeticao
  }
});
