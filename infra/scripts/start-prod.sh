#!/bin/sh
# =============================================================================
# Plataforma Defesa Civil MG — Inicialização (PRODUÇÃO / Azure VM B2)
# =============================================================================
# Uso (na raiz do repositório):
#   ./infra/scripts/start-prod.sh
#
# Arquitetura: standalone (só api + web). PostgreSQL é gerenciado na Azure e os
# anexos vão para o Azure Blob — NÃO há postgres/redis nesta VM.
#
# Pré-requisitos:
#   - Docker + Docker Compose v2
#   - .env preenchido (DATABASE_URL do Azure com sslmode=require, JWT secrets,
#     CORS_ORIGINS, STORAGE_DRIVER=azure + AZURE_STORAGE_CONNECTION_STRING)
#   - Certificados TLS em ./infra/nginx/certs/ (Let's Encrypt via Certbot)
#
# O que faz:
#   1. Valida .env e certificados TLS
#   2. Builda as imagens (api + web)
#   3. Sobe a stack (docker-compose.prod.yml)
#   4. Aguarda o healthcheck da API
#   5. Aplica migrations Prisma dentro do container da API
#
# OBS: o SEED inicial (perfis + admin) usa tsx (devDependency) e NÃO roda no
# container de runtime. Rode-o de uma máquina com o repo + pnpm apontando
# DATABASE_URL para o Azure (ver docs/DEPLOY-AZURE.md, passo 6).
# =============================================================================
set -eu
cd "$(dirname "$0")/../.."

VERDE='\033[0;32m'
VERMELHO='\033[0;31m'
AMARELO='\033[1;33m'
CIANO='\033[0;36m'
RESET='\033[0m'

COMPOSE="docker compose -f docker-compose.prod.yml"

echo ""
echo "${CIANO}== Plataforma Defesa Civil MG — Produção (Azure B2) ==${RESET}"

# ── 1. Validar .env e TLS ──────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  echo "${VERMELHO}[ERR] .env não encontrado. Crie a partir do .env.example.${RESET}"
  exit 1
fi
echo "${VERDE}[1/5] .env encontrado.${RESET}"

CERT_DIR="./infra/nginx/certs"
if [ ! -f "${CERT_DIR}/fullchain.pem" ] || [ ! -f "${CERT_DIR}/privkey.pem" ]; then
  echo "${AMARELO}[AVISO] Certificados TLS ausentes em ${CERT_DIR}/. Emita via Certbot (ver DEPLOY-AZURE.md, passo 8).${RESET}"
fi
echo "${VERDE}[2/5] Certificados TLS verificados.${RESET}"

# ── 2. Build + subir ───────────────────────────────────────────────────────────
echo "${CIANO}[3/5] Buildando imagens (api + web)...${RESET}"
$COMPOSE build
echo "${CIANO}[4/5] Subindo a stack...${RESET}"
$COMPOSE up -d

# ── 3. Aguardar a API ficar saudável ───────────────────────────────────────────
echo "${CIANO}      Aguardando a API ficar saudável (máx. 120s)...${RESET}"
TENTATIVAS=0
MAX=60
while [ $TENTATIVAS -lt $MAX ]; do
  TENTATIVAS=$((TENTATIVAS + 1))
  API_OK=$($COMPOSE ps api --format json 2>/dev/null | grep -c '"healthy"' || true)
  printf "  api:%s (tentativa %d/%d)\r" "$API_OK" "$TENTATIVAS" "$MAX"
  if [ "$API_OK" -ge 1 ]; then
    echo ""
    echo "${VERDE}      API saudável.${RESET}"
    break
  fi
  sleep 2
done

# ── 4. Migrations Prisma (prisma é dependência de produção) ─────────────────────
echo "${CIANO}[5/5] Aplicando migrations Prisma...${RESET}"
$COMPOSE exec -T -w /app/apps/api api /app/node_modules/.bin/prisma migrate deploy
echo "${VERDE}      Migrations aplicadas.${RESET}"

echo ""
echo "${VERDE}== Plataforma em produção ==${RESET}"
echo "  Acesso : https://SEU_DOMINIO"
echo "  Health : https://SEU_DOMINIO/api/health"
echo "  Logs   : ${COMPOSE} logs -f api"
echo "  Parar  : ${COMPOSE} down"
echo ""
$COMPOSE ps
