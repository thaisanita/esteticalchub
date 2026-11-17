import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extrai uma mensagem de erro legível de um valor `unknown` apanhado num catch.
 * Substitui o padrão `catch (err: any) { err.message }`, que perde a
 * verificação de tipos do TypeScript.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Erro desconhecido';
}

/**
 * Converte texto de um valor monetário digitado em número, aceitando tanto o
 * formato europeu ("1.000,50" ou "1.000") como o formato simples ("1000.50").
 *
 * Antes, o código só fazia `.replace(',', '.')`, o que interpretava "1.000"
 * (mil euros, com ponto de milhar) como "1.000" decimal — ou seja, 1 euro.
 * Esta função decide se o último separador é decimal (1 ou 2 dígitos a seguir,
 * como em cêntimos) ou de milhar (3 dígitos a seguir), e só então converte.
 */
export function parseMoeda(valorDigitado: string | number | null | undefined): number {
  if (typeof valorDigitado === 'number') return valorDigitado;
  if (!valorDigitado) return 0;

  const limpo = String(valorDigitado).trim().replace(/[^\d.,]/g, '');
  if (!limpo) return 0;

  const ultimoPonto = limpo.lastIndexOf('.');
  const ultimaVirgula = limpo.lastIndexOf(',');
  const posSeparador = Math.max(ultimoPonto, ultimaVirgula);

  if (posSeparador === -1) {
    return parseFloat(limpo) || 0;
  }

  const casasDepois = limpo.length - posSeparador - 1;
  const ehSeparadorDecimal = casasDepois === 1 || casasDepois === 2;

  if (ehSeparadorDecimal) {
    const parteInteira = limpo.slice(0, posSeparador).replace(/[.,]/g, '');
    const parteDecimal = limpo.slice(posSeparador + 1);
    return parseFloat(`${parteInteira}.${parteDecimal}`) || 0;
  }

  // Nenhum separador parece ser decimal (ex: "1.000") — todos são de milhar.
  return parseFloat(limpo.replace(/[.,]/g, '')) || 0;
}
/**
 * Formata uma hora vinda da base de dados (ex.: "09:00:00", tipo `time` do
 * Postgres) para o formato curto HH:mm mostrado na interface.
 */
export function formatarHora(hora: string | null | undefined): string {
  if (!hora) return '';
  return hora.slice(0, 5);
}

/** true quando a agenda atende fora do estúdio (domicílio ou ambos). */
/**
 * Tipo de atendimento da AGENDA (coluna antiga, já não editável na app).
 * Só serve para interpretar agendamentos antigos — ver agendamentoEDomicilio.
 */
export function atendeDomicilio(tipoAtendimento?: string | null): boolean {
  return tipoAtendimento === 'domicilio' || tipoAtendimento === 'ambos';
}

/**
 * Morada completa de uma cliente numa só linha: "Rua e número, 0000-000 Localidade".
 * Clientes antigas só têm `morada` (texto livre) — aparece tal como foi escrita.
 */
export function moradaCompleta(c: {
  morada?: string | null;
  codigo_postal?: string | null;
  localidade?: string | null;
}): string {
  const linha2 = [c.codigo_postal, c.localidade].map((v) => (v || '').trim()).filter(Boolean).join(' ');
  return [(c.morada || '').trim(), linha2].filter(Boolean).join(', ');
}

/**
 * Este agendamento é ao domicílio? Agendamentos novos guardam a resposta em
 * `local_tipo`. Os antigos (sem `local_tipo`) seguem o tipo da agenda onde
 * ficaram, como funcionava antes — assim continuam a aparecer igual.
 */
export function agendamentoEDomicilio(
  ag: { local_tipo?: string | null },
  tipoAtendimentoAgenda?: string | null,
): boolean {
  if (ag.local_tipo === 'domicilio') return true;
  if (ag.local_tipo === 'estudio') return false;
  return atendeDomicilio(tipoAtendimentoAgenda);
}

/** Link do Google Maps para abrir uma morada/local diretamente. */
export function linkGoogleMaps(morada: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(morada)}`;
}

/**
 * Cor de um valor monetário pelo sinal: verde se positivo, vermelho se
 * negativo, neutra se for zero. Usar em lucros/saldos, não em faturação.
 */
export function classeValorSinal(valor: number): string {
  if (valor > 0) return "text-success";
  if (valor < 0) return "text-danger";
  return "text-foreground";
}

// ---------------------------------------------------------------------------
// Formatação em português de Portugal — usar sempre estas duas funções.
// ---------------------------------------------------------------------------

const FORMATO_EURO = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Valor em euros: "150,00 €", "−240,00 €" (vírgula nos decimais, € no fim,
 * sinal de menos verdadeiro). O espaço antes do € não deixa partir a linha.
 * Aceita números ou texto vindo da base de dados ("12.50", "-3").
 */
export function formatarEuro(valor: number | string | null | undefined): string {
  let n: number;
  if (typeof valor === 'number') n = valor;
  else {
    const texto = String(valor ?? '').trim();
    n = (texto.startsWith('-') || texto.startsWith('−') ? -1 : 1) * parseMoeda(texto);
  }
  if (!Number.isFinite(n)) n = 0;
  n = Math.round(n * 100) / 100;
  return `${n < 0 ? '−' : ''}${FORMATO_EURO.format(Math.abs(n))} €`;
}

/** Data "10/11/2026", a partir de "2026-11-10", "2026-11-10T09:00:00Z" ou de um Date. */
export function formatarData(data: string | Date | null | undefined): string {
  if (!data) return '';
  if (data instanceof Date) {
    if (Number.isNaN(data.getTime())) return '';
    return `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`;
  }
  // Só a data ("2026-11-10"): sem passar por fuso horário, para não mudar de dia.
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    const [a, m, d] = data.split('-');
    return `${d}/${m}/${a}`;
  }
  const d = new Date(data);
  return Number.isNaN(d.getTime()) ? data : formatarData(d);
}

/** "1 atendimento", "3 atendimentos". */
export function plural(n: number, singular: string, pluralTexto: string): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}
