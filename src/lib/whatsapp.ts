// Mensagem de WhatsApp de uma marcação: modelo editável + variáveis + links.
// Funções puras (sem Supabase), para se poderem testar.
import { formatarData, formatarHora } from './utils';
import { URL_PUBLICO } from './empresa';

export const TIPO_MODELO_WHATSAPP = 'whatsapp_marcacao';

/** Variáveis que o modelo aceita, por esta ordem nos botões de inserir. */
export const VARIAVEIS_WHATSAPP: { chave: string; descricao: string; exemplo: string }[] = [
  { chave: 'cliente', descricao: 'Primeiro nome da cliente', exemplo: 'Ana' },
  { chave: 'procedimento', descricao: 'Procedimento', exemplo: 'Pestanas' },
  { chave: 'dia', descricao: 'Dia', exemplo: '21/11/2026' },
  { chave: 'hora', descricao: 'Hora', exemplo: '10:00' },
  { chave: 'local', descricao: 'Local ou morada', exemplo: 'Sala 1' },
  { chave: 'link_confirmacao', descricao: 'Link para a cliente confirmar', exemplo: `${URL_PUBLICO}/confirmacao/…` },
];

export const MODELO_WHATSAPP_PADRAO = [
  'Olá, {cliente}! 😊',
  'A tua marcação de {procedimento} está agendada para {dia} às {hora}.',
  'Local: {local}',
  'Confirma aqui, por favor: {link_confirmacao}',
  'Até breve!',
].join('\n');

export type ValoresWhatsApp = Record<string, string>;

/**
 * Preenche o modelo. Uma linha que use uma variável sem valor (ex.: sem local
 * ou sem link) desaparece inteira, para não ficar "Local: " vazio.
 */
export function preencherModelo(modelo: string, valores: ValoresWhatsApp): string {
  const linhas = modelo.split('\n').flatMap((linha) => {
    let vazia = false;
    const preenchida = linha.replace(/\{(\w+)\}/g, (inteiro, chave: string) => {
      if (!(chave in valores)) return inteiro; // variável desconhecida: fica como está
      const v = (valores[chave] ?? '').trim();
      if (!v) vazia = true;
      return v;
    });
    return vazia ? [] : [preenchida];
  });
  return linhas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Dados de uma marcação → valores das variáveis. */
export function valoresDaMarcacao(m: {
  cliente?: string | null;
  procedimento?: string | null;
  data?: string | null;
  hora?: string | null;
  local?: string | null;
  confirmacaoToken?: string | null;
}): ValoresWhatsApp {
  return {
    cliente: String(m.cliente || '').trim().split(/\s+/)[0] || '',
    procedimento: String(m.procedimento || '').trim(),
    dia: m.data ? formatarData(m.data.slice(0, 10)) : '',
    hora: m.hora ? formatarHora(m.hora) || '' : '',
    local: String(m.local || '').trim(),
    link_confirmacao: m.confirmacaoToken ? `${URL_PUBLICO}/confirmacao/${m.confirmacaoToken}` : '',
  };
}

/**
 * Telefone guardado → número para o WhatsApp (só dígitos, com indicativo).
 * "912 345 678" → "351912345678"; "+44 7700 900123" → "447700900123";
 * "00351 912…" → "351912…". Sem número utilizável → null.
 */
export function numeroWhatsApp(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  const temMais = telefone.trim().startsWith('+');
  let d = telefone.replace(/\D/g, '');
  if (!d) return null;
  if (!temMais && d.startsWith('00')) d = d.slice(2);
  // Número português sem indicativo (9 dígitos, começa por 2 ou 9).
  if (!temMais && d.length === 9 && /^[29]/.test(d)) d = `351${d}`;
  return d.length >= 10 && d.length <= 15 ? d : null;
}

/** Telemóvel/tablet (abre a app WhatsApp) ou computador (abre o WhatsApp Web). */
export function eDispositivoMovel(userAgent: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  return /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(userAgent);
}

/**
 * Link para abrir o WhatsApp com a mensagem escrita.
 *  - Telemóvel: https://wa.me/?text=… (sem número: a profissional escolhe a quem
 *    envia) ou https://wa.me/351…?text=… (conversa da cliente).
 *  - Computador: o mesmo no WhatsApp Web (web.whatsapp.com/send), para não
 *    passar pela página intermédia do wa.me.
 */
export function linkWhatsApp(texto: string, numero: string | null, movel: boolean = eDispositivoMovel()): string {
  const t = encodeURIComponent(texto);
  if (movel) return numero ? `https://wa.me/${numero}?text=${t}` : `https://wa.me/?text=${t}`;
  return numero
    ? `https://web.whatsapp.com/send?phone=${numero}&text=${t}`
    : `https://web.whatsapp.com/send?text=${t}`;
}
