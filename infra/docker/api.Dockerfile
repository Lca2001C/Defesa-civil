# =============================================================================
# API (NestJS) — imagem multi-stage (Alpine no build E no runtime)
# -----------------------------------------------------------------------------
# Build e runtime usam a MESMA libc (musl/Alpine) de proposito: ha modulos
# nativos (ex.: argon2) cujo .node e especifico da libc. Compilar em musl e
# rodar em glibc (Debian), ou vice-versa, quebra o carregamento do binario.
#
# Prisma: o Query Engine e selecionado por libc + versao do OpenSSL. O
# node:20-alpine atual usa OpenSSL 3 (libssl.so.3). Por isso o schema fixa
# binaryTargets no engine "linux-musl-openssl-3.0.x" e NAO embarca mais o
# engine legado "linux-musl" (OpenSSL 1.1) — era ele, exigindo a libssl.so.1.1
# (ausente no Alpine recente), que crashava o boot do PrismaService.
# =============================================================================

# ----------------------------------------------------------------------------
# Stage 1 — build
# ----------------------------------------------------------------------------
FROM node:20-alpine AS build

# Habilita o pnpm via corepack (gestor de pacotes do monorepo).
RUN corepack enable

# Toolchain para compilar modulos nativos (ex.: argon2) quando nao ha prebuild
# para a plataforma/libc. Fica apenas no stage de build; nao vai para o runtime.
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copia todo o repositorio (contexto de build = raiz do monorepo).
COPY . .

# Instala TODAS as dependencias (incl. dev) para conseguir compilar.
RUN pnpm install --frozen-lockfile

# Gera o Prisma Client ANTES do build: os tipos de @prisma/client sao importados
# por dezenas de arquivos da API; sem o client gerado o "nest build" (tsc) falha.
RUN pnpm --filter @dcmg/api exec prisma generate

# Constroi a API e suas dependencias internas (contracts primeiro).
RUN pnpm --filter @dcmg/api... run build

# Remove as devDependencies, mantendo apenas as de producao.
RUN pnpm install --frozen-lockfile --prod

# Regenera o Prisma Client APOS o prune (prisma e dep de producao), garantindo
# que .prisma/client exista no node_modules que vai para o runtime.
RUN pnpm --filter @dcmg/api exec prisma generate

# ----------------------------------------------------------------------------
# Stage 2 — runtime
# ----------------------------------------------------------------------------
FROM node:20-alpine AS runtime

# OpenSSL 3 para o Prisma Query Engine. O node:20-alpine ja inclui a libssl.so.3;
# instalar o pacote "openssl" garante que o Prisma detecte a versao do OpenSSL e
# selecione o engine linux-musl-openssl-3.0.x. Substitui o paliativo fragil de
# baixar compat-openssl11 (libssl.so.1.1) do repo legado v3.18 do Alpine.
RUN apk add --no-cache openssl

ENV NODE_ENV=production
# Limita o heap do V8 para caber com folga no limite de memoria do container.
ENV NODE_OPTIONS="--max-old-space-size=1536"

WORKDIR /app

# Copia a arvore ja construida e com dependencias de producao.
# A imagem node:20-alpine ja inclui o usuario/grupo "node" (nao-root).
COPY --from=build --chown=node:node /app /app

# Diretorio de uploads (montado como volume em runtime, se aplicavel).
RUN mkdir -p /data/uploads && chown -R node:node /data/uploads

USER node

WORKDIR /app/apps/api

EXPOSE 4000

CMD ["node", "dist/main.js"]
