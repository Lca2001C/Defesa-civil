import type { Request } from 'express';

/** Mascara um CPF (11 dígitos) para exibição: ***.NNN.NNN-**. */
export function mascaraCpf(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '***.$2.$3-**');
}

/**
 * Extrai o IP do cliente a partir do cabeçalho `x-forwarded-for` (primeiro IP da
 * cadeia) com fallback para `req.ip`. Centraliza a lógica usada em guard,
 * interceptor e controllers.
 */
export function extrairIp(req: Pick<Request, 'ip' | 'headers'>): string {
  const fwd = req.headers['x-forwarded-for'];
  const primeiro = Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0];
  return primeiro?.trim() ?? req.ip ?? 'unknown';
}
