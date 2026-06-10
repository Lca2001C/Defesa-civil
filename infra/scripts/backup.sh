#!/bin/sh
# =============================================================================
# Backup do banco de dados PostgreSQL (Defesa Civil MG).
# -----------------------------------------------------------------------------
# Executa pg_dump dentro do container "postgres" via docker compose e grava
# um dump comprimido (formato custom do pg_restore) no host.
#
# Uso:
#   ./infra/scripts/backup.sh [diretorio_destino]
#
# As credenciais sao lidas do arquivo .env na raiz do repositorio.
# =============================================================================
set -eu

# Diretorio onde os backups serao gravados (padrao: ./backups).
BACKUP_DIR="${1:-./backups}"
mkdir -p "${BACKUP_DIR}"

# Carrega variaveis do .env (POSTGRES_USER, POSTGRES_DB, etc.).
if [ -f ".env" ]; then
  # shellcheck disable=SC1091
  . ./.env
fi

: "${POSTGRES_USER:=dcmg}"
: "${POSTGRES_DB:=defesa_civil_mg}"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUTFILE="${BACKUP_DIR}/${POSTGRES_DB}_${TIMESTAMP}.dump"

echo "[backup] Gerando dump de ${POSTGRES_DB} em ${OUTFILE}"

# pg_dump no formato custom (-Fc) permite restauracao seletiva e comprimida.
# A saida do container e redirecionada para o arquivo no host.
docker compose exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -Fc \
  > "${OUTFILE}"

echo "[backup] Concluido: ${OUTFILE}"

# -----------------------------------------------------------------------------
# Sugestao (descomente para agendar via cron, p.ex. diariamente as 02h):
#   0 2 * * * cd /caminho/do/repo && ./infra/scripts/backup.sh /var/backups/dcmg
# -----------------------------------------------------------------------------
