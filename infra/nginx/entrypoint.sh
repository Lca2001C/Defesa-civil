#!/bin/sh
# =============================================================================
# Entrypoint do container web (Nginx).
# -----------------------------------------------------------------------------
# 1) Renderiza a config do Nginx a partir do template, injetando ${API_UPSTREAM}
#    (destino do proxy /api). Permite a MESMA imagem servir:
#       - docker-compose (dev):        API_UPSTREAM=api:4000
#       - Azure Container Apps (sidecar): API_UPSTREAM=127.0.0.1:4000
#    Em producao na VM, o docker-compose.prod.yml MONTA nginx.prod.conf (somente
#    leitura) sobre default.conf — nesse caso o render e PULADO e a config
#    montada prevalece.
# 2) Gera o arquivo /env.js (runtime config) a partir das variaveis de ambiente.
# 3) Inicia o Nginx em primeiro plano.
#
# A SPA carrega /env.js ANTES do bundle e le window.__ENV__ para descobrir, em
# tempo de execucao, o ambiente e os caminhos relativos da API. Assim a mesma
# imagem roda em qualquer ambiente (build once, deploy anywhere).
# =============================================================================
set -eu

# Valores padrao.
: "${APP_ENV:=production}"
: "${API_BASE_URL:=/api}"
# Destino do proxy /api. Padrao = api:4000 (rede do docker-compose). No Azure
# Container Apps (web e api na MESMA replica), defina API_UPSTREAM=127.0.0.1:4000.
: "${API_UPSTREAM:=api:4000}"

# ---- 1. Renderiza a config do Nginx (se default.conf for gravavel) ----------
TEMPLATE="/etc/nginx/templates/default.conf.template"
TARGET="/etc/nginx/conf.d/default.conf"
if [ -f "$TEMPLATE" ] && ( touch "$TARGET" 2>/dev/null ); then
  export API_UPSTREAM
  # Substitui SOMENTE ${API_UPSTREAM}, preservando $host, $remote_addr etc.
  envsubst '${API_UPSTREAM}' < "$TEMPLATE" > "$TARGET"
  echo "[entrypoint] default.conf renderizado (API_UPSTREAM=${API_UPSTREAM})"
else
  echo "[entrypoint] default.conf montado/somente-leitura — mantendo a config existente"
fi

# ---- 2. Gera o env.js (runtime config da SPA) -------------------------------
ENV_JS_PATH="/usr/share/nginx/html/env.js"
echo "[entrypoint] Gerando ${ENV_JS_PATH} (APP_ENV=${APP_ENV})"
export APP_ENV API_BASE_URL
envsubst '${APP_ENV} ${API_BASE_URL}' > "${ENV_JS_PATH}" <<'EOF'
window.__ENV__ = {
  APP_ENV: "${APP_ENV}",
  API_BASE_URL: "${API_BASE_URL}"
};
EOF
echo "[entrypoint] env.js gerado:"
cat "${ENV_JS_PATH}"

# ---- 3. Inicia o Nginx em foreground (PID 1) --------------------------------
exec nginx -g "daemon off;"
