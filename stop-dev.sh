#!/bin/sh
# Para containers Docker e processos Node iniciados pelo start-dev.sh
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "Parando Plataforma Defesa Civil MG..."

docker compose stop postgres 2>/dev/null && echo "  Containers parados." || true

# Mata processos nest/vite em background
pkill -f "nest start" 2>/dev/null && echo "  Processo API encerrado." || true
pkill -f "vite"       2>/dev/null && echo "  Processo Vite encerrado." || true

echo "  Plataforma parada."
