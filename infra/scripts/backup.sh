#!/bin/sh
# =============================================================================
# Backup do banco de dados PostgreSQL (Defesa Civil MG).
# -----------------------------------------------------------------------------
# Gera um dump comprimido (formato custom), envia para diretório local e
# aplica política de retenção (mantém os últimos N dias, padrão 7).
#
# Uso:
#   ./infra/scripts/backup.sh [diretório_destino] [dias_de_retenção]
#
# Exemplos:
#   ./infra/scripts/backup.sh                        → ./backups, 7 dias
#   ./infra/scripts/backup.sh /var/backups/dcmg 14   → /var/backups/dcmg, 14 dias
#
# Cron (diariamente às 02h):
#   0 2 * * * cd /caminho/do/repo && ./infra/scripts/backup.sh /var/backups/dcmg 7 >> /var/log/dcmg-backup.log 2>&1
#
# As credenciais são lidas do arquivo .env na raiz do repositório.
# =============================================================================
set -eu

BACKUP_DIR="${1:-./backups}"
RETENCAO_DIAS="${2:-7}"

mkdir -p "${BACKUP_DIR}"

# Carrega variáveis do .env
if [ -f ".env" ]; then
  # shellcheck disable=SC1091
  . ./.env
fi

: "${POSTGRES_USER:=dcmg}"
: "${POSTGRES_DB:=defesa_civil_mg}"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUTFILE="${BACKUP_DIR}/${POSTGRES_DB}_${TIMESTAMP}.dump"

echo "[backup] $(date '+%Y-%m-%d %H:%M:%S') — Iniciando dump de ${POSTGRES_DB}"

# pg_dump no formato custom (-Fc): comprimido e restaurável de forma seletiva.
docker compose exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -Fc \
  > "${OUTFILE}"

TAMANHO="$(du -sh "${OUTFILE}" | cut -f1)"
echo "[backup] Dump concluído: ${OUTFILE} (${TAMANHO})"

# ---------------------------------------------------------------------------
# Política de retenção: remove dumps com mais de RETENCAO_DIAS dias.
# ---------------------------------------------------------------------------
REMOVIDOS=0
for ARQUIVO in "${BACKUP_DIR}"/*.dump; do
  # Ignora se o glob não expandiu (diretório vazio)
  [ -f "${ARQUIVO}" ] || continue
  # Verifica a idade do arquivo em dias
  if find "${ARQUIVO}" -mtime "+${RETENCAO_DIAS}" | grep -q .; then
    rm -f "${ARQUIVO}"
    echo "[backup] Removido (retenção ${RETENCAO_DIAS}d): ${ARQUIVO}"
    REMOVIDOS=$((REMOVIDOS + 1))
  fi
done

echo "[backup] $(date '+%Y-%m-%d %H:%M:%S') — Concluído. Removidos: ${REMOVIDOS} arquivo(s) antigo(s)."
echo "[backup] Dumps disponíveis em ${BACKUP_DIR}:"
ls -lh "${BACKUP_DIR}"/*.dump 2>/dev/null | awk '{print "  " $5 "\t" $9}' || echo "  (nenhum)"
