#!/bin/sh
# =============================================================================
# Plataforma Defesa Civil MG — Script de inicialização (PRODUÇÃO / VPS)
# =============================================================================
# Uso (na raiz do repositório):
#   ./infra/scripts/start-prod.sh
#
# Pré-requisitos:
#   - Docker + Docker Compose v2 instalados
#   - .env preenchido com variáveis de produção
#   - Certificados TLS em ./infra/nginx/certs/ (Let's Encrypt via Certbot)
#
# O que faz:
#   1. Valida existência do .env e dos certificados TLS
#   2. Builda as imagens da API e do frontend
#   3. Sobe toda a stack (postgres, redis, api, web)
#   4. Aguarda healthchecks
#   5. Executa migrations Prisma dentro do container da API
#   6. Executa o seed de referência (UFs/municípios) se ainda não aplicado
#   7. Exibe status final
# =============================================================================
set -eu
cd "$(dirname "$0")/../.."

AMARELO='\033[1;33m'
VERDE='\033[0;32m'
VERMELHO='\033[0;31m'
CIANO='\033[0;36m'
RESET='\033[0m'

echo ""
echo "${CIANO}╔══════════════════════════════════════════════════════╗${RESET}"
echo "${CIANO}║    Plataforma Defesa Civil MG — Produção             ║${RESET}"
echo "${CIANO}╚══════════════════════════════════════════════════════╝${RESET}"
echo ""

# ── 1. Validar .env ────────────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  echo "${VERMELHO}[ERR] Arquivo .env não encontrado. Crie-o a partir do .env.example.${RESET}"
  exit 1
fi
echo "${VERDE}[1/7] .env encontrado.${RESET}"

# ── 2. Validar certificados TLS ────────────────────────────────────────────────
CERT_DIR="./infra/nginx/certs"
if [ ! -f "${CERT_DIR}/fullchain.pem" ] || [ ! -f "${CERT_DIR}/privkey.pem" ]; then
  echo "${AMARELO}[AVISO] Certificados TLS não encontrados em ${CERT_DIR}/.${RESET}"
  echo "        Execute o Certbot para emitir os certificados antes de continuar."
  echo "        Consulte os comentários do docker-compose.prod.yml."
  # Não aborta — permite rodar sem TLS em staging
fi
echo "${VERDE}[2/7] Certificados TLS verificados.${RESET}"

# ── 3. Build das imagens ───────────────────────────────────────────────────────
echo "${CIANO}[3/7] Buildando imagens Docker...${RESET}"
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  build --parallel
echo "${VERDE}      Build concluído.${RESET}"

# ── 4. Subir a stack ───────────────────────────────────────────────────────────
echo "${CIANO}[4/7] Subindo stack de produção...${RESET}"
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d
echo "${VERDE}      Stack iniciada.${RESET}"

# ── 5. Aguardar healthchecks ───────────────────────────────────────────────────
echo "${CIANO}[5/7] Aguardando healthchecks (máx. 120s)...${RESET}"
TENTATIVAS=0
MAX=60
while [ $TENTATIVAS -lt $MAX ]; do
  TENTATIVAS=$((TENTATIVAS + 1))
  PG_OK=$(docker compose ps postgres --format json 2>/dev/null | grep -c '"healthy"' || true)
  RD_OK=$(docker compose ps redis   --format json 2>/dev/null | grep -c '"healthy"' || true)
  API_OK=$(docker compose ps api    --format json 2>/dev/null | grep -c '"healthy"' || true)
  printf "  postgres:%s redis:%s api:%s (tentativa %d/%d)\r" "$PG_OK" "$RD_OK" "$API_OK" "$TENTATIVAS" "$MAX"
  if [ "$PG_OK" -ge 1 ] && [ "$RD_OK" -ge 1 ] && [ "$API_OK" -ge 1 ]; then
    echo ""
    echo "${VERDE}      Todos os serviços saudáveis.${RESET}"
    break
  fi
  sleep 2
done

# ── 6. Migrations Prisma ───────────────────────────────────────────────────────
echo "${CIANO}[6/7] Aplicando migrations Prisma...${RESET}"
docker compose exec -T api npx prisma migrate deploy
echo "${VERDE}      Migrations aplicadas.${RESET}"

# ── 7. Seed de referência (idempotente) ───────────────────────────────────────
echo "${CIANO}[7/7] Executando seed IBGE (idempotente)...${RESET}"
docker compose exec -T api npx prisma db seed || true
echo "${VERDE}      Seed concluído.${RESET}"

# ── Resumo ─────────────────────────────────────────────────────────────────────
echo ""
echo "${VERDE}╔══════════════════════════════════════════════════════╗${RESET}"
echo "${VERDE}║         Plataforma em produção!                      ║${RESET}"
echo "${VERDE}╠══════════════════════════════════════════════════════╣${RESET}"
echo "${VERDE}║  Acesso : https://SEU_DOMINIO                        ║${RESET}"
echo "${VERDE}║  API    : https://SEU_DOMINIO/api                    ║${RESET}"
echo "${VERDE}║  Health : https://SEU_DOMINIO/api/health/ready       ║${RESET}"
echo "${VERDE}╠══════════════════════════════════════════════════════╣${RESET}"
echo "${AMARELO}║  Backup : ./infra/scripts/backup.sh                  ║${RESET}"
echo "${AMARELO}║  Parar  : docker compose down                        ║${RESET}"
echo "${VERDE}╚══════════════════════════════════════════════════════╝${RESET}"
echo ""
docker compose ps
