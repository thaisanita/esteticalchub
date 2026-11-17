import { useEffect, useState } from 'react';

/**
 * Pesquisa de códigos postais portugueses na GEO API PT (json.geoapi.pt,
 * gratuita, com CORS aberto). Formato confirmado da resposta:
 *   { CP, Localidade, Concelho, Distrito, partes: [{ Artéria, ... }], ruas: [...] }
 * As ruas vêm de `partes[].Artéria` (nome completo, ex.: "Rua da Rapadoura").
 * O campo `ruas` é ignorado de propósito: vem abreviado e em maiúsculas
 * ("R RAPADOURA").
 *
 * Se a API falhar ou estiver em baixo, o hook só devolve estado 'erro' —
 * quem usa continua a poder preencher tudo à mão.
 */

const URL_API = 'https://json.geoapi.pt/cp/';
const TEMPO_LIMITE_MS = 8000;

export interface DadosCodigoPostal {
  /** Sempre no formato 0000-000. */
  codigo: string;
  localidade: string;
  concelho: string;
  distrito: string;
  /** Nomes de rua sem duplicados, por ordem alfabética (pt). */
  ruas: string[];
}

export type EstadoCodigoPostal =
  | 'vazio' // campo vazio
  | 'incompleto' // ainda não tem 7 dígitos (não faz pedido)
  | 'a_procurar'
  | 'encontrado'
  | 'nao_encontrado' // 404 da API
  | 'erro'; // API em baixo, sem rede, tempo esgotado, resposta estranha

/**
 * Devolve o código no formato 0000-000 se tiver exatamente 7 dígitos
 * ("4930001", "4930-001" ou "4930 001"); caso contrário, null.
 */
export function normalizarCodigoPostal(valor: string): string | null {
  const m = valor.trim().match(/^(\d{4})[-\s]?(\d{3})$/);
  return m ? `${m[1]}-${m[2]}` : null;
}

/** Máscara 0000-000 enquanto se escreve: só dígitos, no máximo 7. */
export function mascaraCodigoPostal(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 7);
  return digitos.length > 4 ? `${digitos.slice(0, 4)}-${digitos.slice(4)}` : digitos;
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Converte o JSON da API; null se não tiver o formato esperado. */
export function interpretarRespostaCodigoPostal(json: unknown): DadosCodigoPostal | null {
  if (!json || typeof json !== 'object') return null;
  const r = json as Record<string, unknown>;
  const codigo = normalizarCodigoPostal(texto(r.CP));
  if (!codigo) return null;

  const partes = Array.isArray(r.partes) ? r.partes : [];
  const ruas = Array.from(
    new Set(
      partes
        .map((p) => (p && typeof p === 'object' ? texto((p as Record<string, unknown>)['Artéria']) : ''))
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, 'pt'));

  return {
    codigo,
    localidade: texto(r.Localidade),
    concelho: texto(r.Concelho),
    distrito: texto(r.Distrito),
    ruas,
  };
}

/** "Localidade, Concelho" — sem repetir quando são iguais (ex.: "Valença"). */
export function localidadeComConcelho(d: Pick<DadosCodigoPostal, 'localidade' | 'concelho'>): string {
  const { localidade, concelho } = d;
  if (!localidade) return concelho;
  if (!concelho || localidade.localeCompare(concelho, 'pt', { sensitivity: 'base' }) === 0) return localidade;
  return `${localidade}, ${concelho}`;
}

type Resultado = { codigo: string } & (
  | { estado: 'encontrado'; dados: DadosCodigoPostal }
  | { estado: 'nao_encontrado' | 'erro'; dados: null }
);

// Respostas definitivas (encontrado / não encontrado) ficam em memória: abrir
// de novo a mesma cliente ou voltar ao mesmo código não repete o pedido.
// Erros não ficam guardados, para se poder tentar outra vez.
const cache = new Map<string, Resultado>();

export function useCodigoPostal(valor: string): {
  estado: EstadoCodigoPostal;
  dados: DadosCodigoPostal | null;
  codigo: string | null;
} {
  const codigo = normalizarCodigoPostal(valor);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  useEffect(() => {
    if (!codigo || cache.has(codigo)) return;

    // Cancela o pedido anterior quando o código muda (ou o componente sai).
    const controlador = new AbortController();
    let esgotado = false;
    const temporizador = setTimeout(() => {
      esgotado = true;
      controlador.abort();
    }, TEMPO_LIMITE_MS);

    (async () => {
      let r: Resultado;
      try {
        const resp = await fetch(URL_API + codigo, { signal: controlador.signal });
        if (resp.status === 404) {
          r = { codigo, estado: 'nao_encontrado', dados: null };
          cache.set(codigo, r);
        } else if (!resp.ok) {
          r = { codigo, estado: 'erro', dados: null };
        } else {
          const dados = interpretarRespostaCodigoPostal(await resp.json());
          if (dados) {
            r = { codigo, estado: 'encontrado', dados };
            cache.set(codigo, r);
          } else {
            r = { codigo, estado: 'erro', dados: null };
          }
        }
      } catch {
        // Pedido cancelado porque o código mudou: não mexe no estado.
        if (controlador.signal.aborted && !esgotado) return;
        r = { codigo, estado: 'erro', dados: null };
      } finally {
        clearTimeout(temporizador);
      }
      setResultado(r);
    })();

    return () => {
      clearTimeout(temporizador);
      controlador.abort();
    };
  }, [codigo]);

  if (!valor.trim()) return { estado: 'vazio', dados: null, codigo: null };
  if (!codigo) return { estado: 'incompleto', dados: null, codigo: null };

  // Só aceita um resultado que seja do código atual (nunca de um pedido antigo).
  const atual = cache.get(codigo) ?? (resultado?.codigo === codigo ? resultado : null);
  if (!atual) return { estado: 'a_procurar', dados: null, codigo };
  return { estado: atual.estado, dados: atual.dados, codigo };
}
