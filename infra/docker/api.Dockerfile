# =============================================================================
# API (NestJS) — imagem multi-stage
# -----------------------------------------------------------------------------
# Stage 1 (build): instala dependencias do monorepo, constroi @dcmg/contracts
#                  antes de @dcmg/api (ordem topologica via "..."), remove as
#                  devDependencies e gera o Prisma Client.
# Stage 2 (runtime): imagem enxuta, usuario nao-root, com a arvore ja pronta.
#
# Observacao: o repo usa node-linker=hoisted (.npmrc), entao node_modules sao
# arquivos REAIS (sem o virtual store .pnpm). Por isso a arvore /app pode ser
# copiada entre stages sem symlinks quebradas. Os pacotes de workspace
# (@dcmg/api, @dcmg/contracts) permanecem como symlinks relativos validos
# dentro de /app, que e copiado por completo.
#
# TODO (otimizacao futura): trocar a copia integral de /app por "pnpm deploy
# --filter @dcmg/api --prod" para reduzir o tamanho da imagem (hoje ela carrega
# tambem as deps de producao dos demais workspaces).
# =============================================================================

# ----------------------------------------------------------------------------
# Stage 1 — build
# ----------------------------------------------------------------------------
FROM node:20-alpine AS build

# Habilita o pnpm via corepack (gestor de pacotes do monorepo).
RUN corepack enable

# Toolchain para compilar módulos nativos (ex.: argon2) quando não há prebuild
# para a plataforma/libc — necessário em ARM64/musl (Oracle Ampere A1 + Alpine).
# Fica apenas no stage de build; não vai para a imagem de runtime.
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copia todo o repositorio (contexto de build = raiz do monorepo).
# O pnpm-lock.yaml versionado garante builds reproduziveis (--frozen-lockfile).
COPY . .

# Instala TODAS as dependencias (incl. dev) para conseguir compilar.
RUN pnpm install --frozen-lockfile

# Constroi a API e suas dependencias internas (contracts primeiro).
# A sintaxe "@dcmg/api..." inclui as dependencias do workspace na ordem certa.
RUN pnpm --filter @dcmg/api... run build

# Remove as devDependencies, mantendo apenas as de producao.
# Com node-linker=hoisted o resultado sao arquivos reais em node_modules.
RUN pnpm install --frozen-lockfile --prod

# Gera o Prisma Client APOS o prune (prisma e dependencia de producao), para
# garantir que .prisma/client exista no node_modules que vai para o runtime.
RUN pnpm --filter @dcmg/api exec prisma generate

# ----------------------------------------------------------------------------
# Stage 2 — runtime
# ----------------------------------------------------------------------------
FROM node:20-alpine AS runtime

ENV NODE_ENV=production
# Limita o heap do V8 para caber com folga no limite de memória do container
# (api ~2.5G na B2s). Evita OOM-kill antes de o GC rodar. Ajuste junto com o
# limite de memória do serviço em docker-compose.prod.yml.
ENV NODE_OPTIONS="--max-old-space-size=1536"

WORKDIR /app

# Copia a arvore ja construida e com dependencias de producao:
# node_modules (hoisted, reais), apps/api/dist, prisma, e packages/contracts/dist.
# A imagem node:20-alpine ja inclui o usuario/grupo "node" (nao-root).
COPY --from=build --chown=node:node /app /app

# Diretorio de uploads (montado como volume em runtime via compose).
RUN mkdir -p /data/uploads && chown -R node:node /data/uploads

USER node

WORKDIR /app/apps/api

EXPOSE 4000

CMD ["node", "dist/main.js"]
