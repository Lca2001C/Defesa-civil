#!/bin/sh
# =============================================================================
# Entrypoint do container web (Nginx).
# -----------------------------------------------------------------------------
# Gera o arquivo /env.js (runtime config) a partir das variaveis de ambiente
# e, em seguida, inicia o Nginx em primeiro plano.
#
# A SPA carrega /env.js ANTES do bundle e le window.__ENV__ para descobrir,
# em tempo de execucao, o ambiente e os caminhos relativos da API e do socket.
# Assim a mesma imagem roda em qualquer ambiente (build once, deploy anywhere).
# =============================================================================
set -eu

# Valores padrao (caminhos sempre RELATIVOS — mesma origem via Nginx).
: "${APP_ENV:=production}"
: "${API_BASE_URL:=/api}"

ENV_JS_PATH="/usr/share/nginx/html/env.js"

echo "[entrypoint] Gerando ${ENV_JS_PATH} (APP_ENV=${APP_ENV})"

# Exporta as variaveis para o envsubst conseguir substitui-las.
export APP_ENV API_BASE_URL

# Gera o env.js substituindo apenas as variaveis conhecidas, evitando
# interferir em eventuais cifrões do template.
envsubst '${APP_ENV} ${API_BASE_URL}' > "${ENV_JS_PATH}" <<'EOF'
window.__ENV__ = {
  APP_ENV: "${APP_ENV}",
  API_BASE_URL: "${API_BASE_URL}"
};
EOF

echo "[entrypoint] env.js gerado:"
cat "${ENV_JS_PATH}"

# Inicia o Nginx em foreground (PID 1) para o container permanecer ativo.
exec nginx -g "daemon off;"
