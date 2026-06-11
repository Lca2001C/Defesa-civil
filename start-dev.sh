#!/bin/sh
# =============================================================================
# Plataforma Defesa Civil MG — Inicialização (DESENVOLVIMENTO)
# =============================================================================
# Uso: ./start-dev.sh
#
# O que faz:
#   1. Verifica/cria o .env a partir do .env.example
#   2. Sobe PostgreSQL + Redis via Docker Compose
#   3. Aguarda os serviços ficarem saudáveis
#   4. Executa prisma generate + prisma migrate deploy
#   5. Inicia a API NestJS em modo watch (background)
#   6. Inicia o frontend Vite em modo dev (foreground / último processo)
#
# Pré-requisitos: Docker, Node.js >= 20
# =============================================================================
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# ── 0. Garantir que pnpm esteja disponível ────────────────────────────────────
# Tenta localizar pnpm em caminhos não-convencionais antes de instalar
_pnpm_resolve() {
  for candidate in \
      "$HOME/.local/share/pnpm/pnpm" \
      "$HOME/AppData/Roaming/npm/pnpm" \
      "/usr/local/bin/pnpm" \
      "/usr/bin/pnpm"; do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

if ! command -v pnpm >/dev/null 2>&1; then
  PNPM_BIN="$(_pnpm_resolve 2>/dev/null || true)"
  if [ -n "$PNPM_BIN" ]; then
    # Encontrado num caminho não exportado — cria alias para a sessão
    alias pnpm="$PNPM_BIN"
    export PATH="$(dirname "$PNPM_BIN"):$PATH"
  else
    echo "${AMARELO:-}[0/6] pnpm não encontrado. Instalando via npm...${RESET:-}"
    npm install -g pnpm
    # Após instalação global o npm coloca o binário em $(npm root -g)/../bin
    NPM_GLOBAL_BIN="$(npm root -g 2>/dev/null | sed 's|/node_modules$||')/bin"
    if [ -x "$NPM_GLOBAL_BIN/pnpm" ]; then
      export PATH="$NPM_GLOBAL_BIN:$PATH"
    fi
    if ! command -v pnpm >/dev/null 2>&1; then
      echo "${VERMELHO:-}[ERR] Não foi possível encontrar pnpm após instalação.${RESET:-}"
      echo "      Instale manualmente: npm install -g pnpm"
      exit 1
    fi
    echo "${VERDE:-}      pnpm instalado com sucesso.${RESET:-}"
  fi
fi

VERDE='\033[0;32m'
CIANO='\033[0;36m'
AMARELO='\033[1;33m'
VERMELHO='\033[0;31m'
RESET='\033[0m'

echo ""
echo "${CIANO}╔══════════════════════════════════════════════════════╗${RESET}"
echo "${CIANO}║      Plataforma Defesa Civil MG — Inicialização      ║${RESET}"
echo "${CIANO}╚══════════════════════════════════════════════════════╝${RESET}"
echo ""

# ── 1. Verificar .env ─────────────────────────────────────────────────────────
if [ ! -f "$ROOT/.env" ]; then
  if [ -f "$ROOT/.env.example" ]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
    echo "${AMARELO}[1/6] .env criado a partir de .env.example.${RESET}"
    echo "      ⚠  Revise as variáveis antes de usar em produção."
  else
    echo "${VERMELHO}[ERR] .env.example não encontrado.${RESET}"
    exit 1
  fi
else
  echo "${VERDE}[1/6] .env encontrado.${RESET}"
fi

# ── 2. Subir PostgreSQL + Redis ───────────────────────────────────────────────
echo "${CIANO}[2/6] Subindo PostgreSQL e Redis (Docker Compose)...${RESET}"
docker compose up postgres redis -d
echo "${VERDE}      Containers iniciados.${RESET}"

# ── 3. Aguardar healthchecks ──────────────────────────────────────────────────
echo "${CIANO}[3/6] Aguardando PostgreSQL e Redis ficarem prontos...${RESET}"
TENTATIVAS=0
MAX=30
while [ $TENTATIVAS -lt $MAX ]; do
  TENTATIVAS=$((TENTATIVAS + 1))
  PG=$(docker compose exec -T postgres pg_isready -q 2>/dev/null && echo 1 || echo 0)
  RD=$(docker compose exec -T redis redis-cli ping 2>/dev/null | grep -c PONG || echo 0)
  printf "  postgres:%s redis:%s (tentativa %d/%d)\r" "$PG" "$RD" "$TENTATIVAS" "$MAX"
  if [ "$PG" = "1" ] && [ "$RD" = "1" ]; then
    echo ""
    echo "${VERDE}      PostgreSQL + Redis prontos.${RESET}"
    break
  fi
  sleep 2
done
if [ $TENTATIVAS -ge $MAX ]; then
  echo ""
  echo "${AMARELO}      Timeout — continuando mesmo assim...${RESET}"
fi

# ── 4. Instalar deps + migrations ────────────────────────────────────────────
echo "${CIANO}[4/6] Instalando dependências e aplicando migrations...${RESET}"

# Instala dependências se necessário
if [ ! -d "$ROOT/node_modules" ]; then
  echo "      Executando pnpm install..."
  pnpm install
fi

# O Prisma procura o .env na pasta onde é executado (apps/api/).
# Sempre sincroniza o .env da raiz para apps/api/.env antes de rodar o Prisma.
cp "$ROOT/.env" "$ROOT/apps/api/.env"
echo "      .env sincronizado para apps/api/.env."

# Gera o Prisma Client
echo "      Gerando Prisma Client..."
(cd "$ROOT/apps/api" && npx prisma generate)

# Aplica migrations
echo "      Aplicando migrations..."
(cd "$ROOT/apps/api" && npx prisma migrate deploy)

echo "${VERDE}      Dependências e migrations prontas.${RESET}"

# ── 5. Iniciar API em background ─────────────────────────────────────────────
echo "${CIANO}[5/6] Iniciando API NestJS (porta 4000)...${RESET}"
pnpm --filter @dcmg/api start:dev > /tmp/dcmg-api.log 2>&1 &
API_PID=$!
echo "      API iniciada (PID $API_PID). Log: /tmp/dcmg-api.log"

# Aguarda a API responder
echo "      Aguardando API em http://localhost:4000/api/health ..."
TENTATIVAS=0
while [ $TENTATIVAS -lt 20 ]; do
  TENTATIVAS=$((TENTATIVAS + 1))
  sleep 2
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/health 2>/dev/null || echo "0")
  if [ "$STATUS" = "200" ]; then
    echo "${VERDE}      API pronta.${RESET}"
    break
  fi
  printf "  aguardando... (%d/20)\r" "$TENTATIVAS"
done
echo ""

# ── 6. Iniciar Frontend (foreground) ─────────────────────────────────────────
echo "${CIANO}[6/6] Iniciando frontend Vite (porta 5173)...${RESET}"
echo ""
echo "${VERDE}╔══════════════════════════════════════════════════════╗${RESET}"
echo "${VERDE}║              Plataforma em execução!                 ║${RESET}"
echo "${VERDE}╠══════════════════════════════════════════════════════╣${RESET}"
echo "${VERDE}║  Frontend : http://localhost:3000                    ║${RESET}"
echo "${VERDE}║  API      : http://localhost:4000/api                ║${RESET}"
echo "${VERDE}║  Swagger  : http://localhost:4000/api/docs           ║${RESET}"
echo "${VERDE}║  Health   : http://localhost:4000/api/health/ready   ║${RESET}"
echo "${VERDE}╠══════════════════════════════════════════════════════╣${RESET}"
echo "${AMARELO}║  Ctrl+C para parar o frontend (API continua em bg)   ║${RESET}"
echo "${AMARELO}║  Para parar tudo: ./stop-dev.sh                      ║${RESET}"
echo "${VERDE}╚══════════════════════════════════════════════════════╝${RESET}"
echo ""

# Roda o Vite em foreground (Ctrl+C para o script)
pnpm --filter @dcmg/web dev
