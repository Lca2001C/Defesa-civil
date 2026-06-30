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

# Configuracao do servidor / proxy reverso (listen 8080) como TEMPLATE: o
# entrypoint a renderiza em /etc/nginx/conf.d/default.conf no boot, injetando
# ${API_UPSTREAM} (destino do proxy /api). Assim a MESMA imagem proxya para
# `api:4000` (docker-compose) ou `127.0.0.1:4000` (sidecar no Azure Container
# Apps). Em producao na VM, o docker-compose.prod.yml MONTA nginx.prod.conf
# (somente leitura) sobre default.conf e o entrypoint pula o render.
COPY infra/nginx/nginx.conf /etc/nginx/templates/default.conf.template

# Entrypoint: renderiza a config, gera o /env.js (runtime config) e inicia o Nginx.
COPY infra/nginx/entrypoint.sh /docker-entrypoint-dcmg.sh
# Remove CR (\r) caso o script chegue com fim de linha CRLF (Windows): senao o
# shebang vira "#!/bin/sh\r" e o container falha com "exec ...: no such file or
# directory". O .gitattributes ja forca LF na fonte; este sed e defesa extra
# para builds feitos a partir de qualquer host (ex.: az acr build no Windows).
RUN sed -i 's/\r$//' /docker-entrypoint-dcmg.sh \
 && chmod +x /docker-entrypoint-dcmg.sh \
 && chown -R nginx:nginx /usr/share/nginx/html /etc/nginx/conf.d

# Volta ao usuario nao-root para a execucao do container.
USER nginx

EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint-dcmg.sh"]
