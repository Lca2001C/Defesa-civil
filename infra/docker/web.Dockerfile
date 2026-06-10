# =============================================================================
# Web (SPA + Nginx) — imagem multi-stage
# -----------------------------------------------------------------------------
# Stage 1 (build): instala dependencias do monorepo, constroi @dcmg/contracts
#                  antes de @dcmg/web e gera o bundle estatico em apps/web/dist.
# Stage 2 (runtime): Nginx NAO-ROOT (nginx-unprivileged) servindo a SPA e
#                    atuando como proxy reverso. Escuta na porta 8080 (porta
#                    nao privilegiada). O env.js (runtime config) e gerado no
#                    boot pelo entrypoint via envsubst.
# =============================================================================

# ----------------------------------------------------------------------------
# Stage 1 — build
# ----------------------------------------------------------------------------
FROM node:20-alpine AS build

# Habilita o pnpm via corepack.
RUN corepack enable

WORKDIR /app

# Copia todo o repositorio (contexto de build = raiz do monorepo).
# O pnpm-lock.yaml versionado garante builds reproduziveis (--frozen-lockfile).
COPY . .

# Instala todas as dependencias do workspace.
RUN pnpm install --frozen-lockfile

# Constroi o front-end e suas dependencias internas (contracts primeiro).
RUN pnpm --filter @dcmg/web... run build

# ----------------------------------------------------------------------------
# Stage 2 — runtime (Nginx nao-root)
# ----------------------------------------------------------------------------
# Imagem oficial nginx-unprivileged: roda como usuario "nginx" (uid 101) e
# escuta em 8080 por padrao, sem necessidade de root.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# Operacoes que exigem root (instalar gettext p/ envsubst, copiar e ajustar
# permissoes). Ao final voltamos para o usuario "nginx" (runtime nao-root).
USER root

# Garante o envsubst (gettext) para o entrypoint gerar o /env.js.
RUN apk add --no-cache gettext

# Bundle estatico da SPA.
COPY --from=build --chown=nginx:nginx /app/apps/web/dist /usr/share/nginx/html

# Configuracao do servidor / proxy reverso (listen 8080). Em producao, o
# docker-compose.prod.yml sobrepoe este arquivo por nginx.prod.conf (TLS).
COPY infra/nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Entrypoint: gera o /env.js (runtime config) e inicia o Nginx.
COPY infra/nginx/entrypoint.sh /docker-entrypoint-dcmg.sh
RUN chmod +x /docker-entrypoint-dcmg.sh \
 && chown -R nginx:nginx /usr/share/nginx/html

# Volta ao usuario nao-root para a execucao do container.
USER nginx

EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint-dcmg.sh"]
