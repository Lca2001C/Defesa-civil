// Configuracao de runtime do SPA (defaults de desenvolvimento).
// Em producao este arquivo e REGERADO no boot do container web a partir das
// variaveis de ambiente (entrypoint Nginx com envsubst).
// Em DEV o Vite faz proxy de /api → localhost:4000, por isso API_BASE_URL
// pode ser relativo. Se quiser apontar direto para a API sem proxy, use:
//   API_BASE_URL: "http://localhost:4000/api"
window.__ENV__ = {
  APP_ENV: "development",
  API_BASE_URL: "/api",
};
