// Configuracao de runtime do SPA (defaults de desenvolvimento).
// Em producao este arquivo e REGERADO no boot do container web a partir das
// variaveis de ambiente (entrypoint Nginx com envsubst), garantindo o
// principio "build once, deploy anywhere": nenhuma URL fica fixa no bundle.
// A SPA sempre fala com a API por caminho RELATIVO na mesma origem.
window.__ENV__ = {
  APP_ENV: "development",
  API_BASE_URL: "/api",
  SOCKET_PATH: "/socket.io",
};
