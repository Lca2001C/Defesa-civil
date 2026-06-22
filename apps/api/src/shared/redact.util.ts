/**
 * Redação de dados sensíveis para logs e auditoria (LGPD / segurança).
 *
 * Centraliza a lista de campos que NUNCA devem ser persistidos/logados em
 * claro. Usada pelo AuditInterceptor e disponível para qualquer ponto que
 * precise sanitizar um objeto antes de logar.
 */

export const PLACEHOLDER_REDIGIDO = '[REDACTED]';

/** Nomes de campo (case-insensitive) cujo valor deve ser sempre redigido. */
const CAMPOS_SENSIVEIS = new Set(
  [
    'senha',
    'senhaHash',
    'senha_hash',
    'password',
    'confirmarSenha',
    'novaSenha',
    'cpf',
    'cpfRespondente',
    'cpf_respondente',
    'dados', // JSONB de respostas pode conter dados pessoais
    'dadosSnapshot',
    'dados_snapshot',
    'token',
    'accessToken',
    'refreshToken',
    'jwt',
    'authorization',
    'cookie',
    'codigo',
    'codigoRecuperacao',
    'tokenRecuperacao',
    'secret',
  ].map((c) => c.toLowerCase()),
);

/** Indica se um nome de campo deve ser redigido (sufixo *_SECRET incluso). */
export function ehCampoSensivel(chave: string): boolean {
  const normalizada = chave.toLowerCase();
  return CAMPOS_SENSIVEIS.has(normalizada) || normalizada.endsWith('_secret');
}

/**
 * Retorna uma cópia do objeto com os campos sensíveis substituídos por
 * `[REDACTED]`. Limita a profundidade para evitar recursão excessiva.
 */
export function redigir(obj: unknown, profundidade = 0): unknown {
  if (profundidade > 3 || obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => redigir(item, profundidade + 1));

  const resultado: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(obj as Record<string, unknown>)) {
    resultado[chave] = ehCampoSensivel(chave)
      ? PLACEHOLDER_REDIGIDO
      : redigir(valor, profundidade + 1);
  }
  return resultado;
}
