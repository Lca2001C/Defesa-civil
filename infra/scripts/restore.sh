#!/bin/sh
# =============================================================================
# Restauracao do banco de dados PostgreSQL (Defesa Civil MG).
# -----------------------------------------------------------------------------
# Restaura um dump (formato custom gerado por backup.sh) dentro do container
# "postgres" via docker compose e pg_restore.
#
# Uso:
#   ./infra/scripts/restore.sh <arquivo.dump>
#
# ATENCAO: --clean remove objetos existentes antes de recriar. Use com cuidado
# em ambientes de producao (de preferencia restaure em base limpa).
# =============================================================================
set -eu

DUMP_FILE="${1:-}"
if [ -z "${DUMP_FILE}" ] || [ ! -f "${DUMP_FILE}" ]; then
  echo "Uso: $0 <arquivo.dump>" >&2
  echo "Erro: arquivo de dump nao informado ou inexistente." >&2
  exit 1
fi

# Carrega variaveis do .env (POSTGRES_USER, POSTGRES_DB, etc.).
if [ -f ".env" ]; then
  # shellcheck disable=SC1091
  . ./.env
fi

: "${POSTGRES_USER:=dcmg}"
: "${POSTGRES_DB:=defesa_civil_mg}"

echo "[restore] Restaurando ${DUMP_FILE} em ${POSTGRES_DB}"

# pg_restore le o dump via STDIN (-T desabilita TTY no exec do compose).
# --clean + --if-exists tornam a operacao idempotente em base ja populada.
docker compose exec -T postgres \
  pg_restore -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
  --clean --if-exists --no-owner \
  < "${DUMP_FILE}"

echo "[restore] Concluido."
