/// <reference types="vite/client" />

// Tipagem da configuracao de runtime injetada por /env.js no objeto global.
// Mantemos os campos opcionais porque, em ambientes mal configurados, o
// runtimeConfig aplica fallbacks seguros.
interface RuntimeEnv {
  APP_ENV?: string;
  API_BASE_URL?: string;
}

interface Window {
  __ENV__?: RuntimeEnv;
}
