import type { Request } from 'express';

/** Mascara um CPF (11 dígitos) para exibição: ***.NNN.NNN-**. */
export function mascaraCpf(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '***.$2.$3-**');
}

/** Escapa texto para interpolação segura em HTML (e-mails). Evita injeção. */
export function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Extrai o IP do cliente. Com `trust proxy` configurado (ver main.ts), o Express
 * já resolve `req.ip` a partir do X-Forwarded-For de forma confiável — então
 * usamos `req.ip` diretamente, evitando confiar no cabeçalho cru (spoofável).
 */
export function extrairIp(req: Pick<Request, 'ip'>): string {
  return req.ip ?? 'unknown';
}
