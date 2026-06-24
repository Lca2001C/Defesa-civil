/**
 * Constantes compartilhadas entre módulos — evita "magic numbers"/strings
 * espalhados pelo código.
 */

/**
 * Níveis de perfil (RBAC), alinhados aos valores semeados em `prisma/seed.ts`.
 * Usados para comparações de autorização baseadas em nível (perfilNivel).
 */
export const PERMISSION_LEVEL = {
  CONSULTA: 10,
  OPERADOR_MUNICIPAL: 20,
  COORDENADOR_COMPDEC: 25,
  ADMIN_MUNICIPAL: 50,
  COORDENADOR_REGIONAL: 60,
  ANALISTA_ESTADUAL: 70,
  GESTOR_ESTADUAL: 80,
  SUPER_ADMIN: 100,
} as const;

/** Tamanho do lote de leitura por cursor na exportação (memória limitada). */
export const EXPORT_BATCH_SIZE = 5000;

/**
 * Limite do upload legado em memória (modo local/dev). Em produção os anexos
 * sobem direto ao Azure Blob via SAS (sem passar pelo servidor).
 */
export const MAX_LEGACY_UPLOAD_BYTES = 200 * 1024 * 1024;

/** Prefixo das chaves de rate limit no cache. */
export const RATE_LIMIT_PREFIX = 'rl:';
