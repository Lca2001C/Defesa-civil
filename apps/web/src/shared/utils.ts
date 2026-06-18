/** Utilitários compartilhados (sem dono de feature). */

/** Mascara um CPF (11 dígitos) para exibição: ***.NNN.NNN-**. */
export function mascaraCpf(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "***.$2.$3-**");
}

/** Extrai uma mensagem legível de um erro desconhecido (substitui `(e as Error).message`). */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Erro desconhecido";
}
