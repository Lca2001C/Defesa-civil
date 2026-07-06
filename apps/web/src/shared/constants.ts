/** Constantes compartilhadas do frontend. */

/**
 * Nível mínimo (perfilNivel) para o MÓDULO ADMIN: gerir usuários, criar/editar/
 * publicar/excluir formulários e abrir/encerrar competências. Apenas Gestor
 * Estadual (80) e Super Admin (100). Espelha a barreira imposta no backend
 * (@NivelMinimo nos controllers). É a fonte da verdade; o front só oculta a UI.
 */
export const NIVEL_MODULO_ADMIN = 80;

/** Tipos de arquivo aceitos no upload de anexos (atributo `accept` do input). */
export const ACCEPT_TIPOS =
  ".pdf,.docx,.doc,.xlsx,.xls,.zip,.png,.jpg,.jpeg,.kml,.kmz,.json,.geojson,.shp,.dbf,.shx,.prj";

/** Chaves de cache do TanStack Query, centralizadas para evitar strings mágicas. */
export const QUERY_KEYS = {
  SUBMISSOES: "submissoes",
  COMPETENCIAS: "competencias",
  MUNICIPIOS: "municipios",
  PAINEL: "painel",
  FORMULARIOS: "formularios",
  USUARIOS: "usuarios",
  DASHBOARD: "dashboard",
  AUDITORIA: "auditoria",
} as const;

/** Intervalo de polling do job de exportação (ms). */
export const POLLING_INTERVAL_MS = 1500;
/** Número máximo de tentativas de polling antes de desistir (~3 min). */
export const MAX_POLLING_ATTEMPTS = 120;
