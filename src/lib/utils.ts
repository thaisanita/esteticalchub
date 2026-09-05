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