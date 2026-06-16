-- Busca textual rápida (ILIKE / contains) em submissões e municípios.
-- Extensão de trigramas + índices GIN para escalar a busca por protocolo,
-- nome do respondente e nome do município mesmo com milhões de registros.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Submissões: busca por protocolo e por nome do respondente.
CREATE INDEX IF NOT EXISTS "submissoes_protocolo_trgm_idx"
  ON "submissoes" USING gin ("protocolo" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "submissoes_nome_respondente_trgm_idx"
  ON "submissoes" USING gin ("nome_respondente" gin_trgm_ops);

-- Municípios: busca por nome (usada no filtro de submissões).
CREATE INDEX IF NOT EXISTS "municipios_nome_trgm_idx"
  ON "municipios" USING gin ("nome" gin_trgm_ops);

-- Índice para ordenação/filtro global por data de criação (sem competência).
CREATE INDEX IF NOT EXISTS "submissoes_created_at_idx"
  ON "submissoes" ("created_at");
