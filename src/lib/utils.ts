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