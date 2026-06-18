/** Constantes compartilhadas do frontend. */

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
