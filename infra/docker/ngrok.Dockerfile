# =============================================================================
# Imagem local do agente ngrok — build SEM depender do Docker Hub.
# -----------------------------------------------------------------------------
# Base: nginx:1.25-alpine (já em cache local; usada apenas como base Alpine).
# O binário do ngrok é baixado pelo host (start-dev.ps1) para infra/ngrok/bin/
# e copiado aqui — assim o build não precisa puxar a imagem ngrok/ngrok do Hub.
# =============================================================================
FROM nginx:1.25-alpine

# CA roots para o ngrok validar TLS com os servidores do ngrok.
# (idempotente; a CDN do Alpine é acessível mesmo com o Docker Hub bloqueado)
RUN apk add --no-cache ca-certificates

# Binário estático do ngrok (linux-amd64) baixado previamente pelo host.
COPY infra/ngrok/bin/ngrok /usr/local/bin/ngrok
RUN chmod +x /usr/local/bin/ngrok

ENTRYPOINT ["ngrok"]
CMD ["start", "--all", "--config", "/etc/ngrok/ngrok.yml"]
