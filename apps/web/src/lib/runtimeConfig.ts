// Le a configuracao de runtime exposta por /env.js (window.__ENV__) e aplica
// fallbacks seguros. Tudo por caminho RELATIVO na mesma origem, conforme o
// principio "build once, deploy anywhere".

export interface RuntimeConfig {
  /** Ambiente logico da aplicacao (ex.: development, staging, production). */
  appEnv: string;
  /** Caminho base RELATIVO da API. Padrao: "/api". */
  apiBaseUrl: string;
}

function lerEnv(): RuntimeEnv {
  if (typeof window !== "undefined" && window.__ENV__) {
    return window.__ENV__;
  }
  return {};
}

const env = lerEnv();

export const runtimeConfig: RuntimeConfig = {
  appEnv: env.APP_ENV ?? "development",
  apiBaseUrl: env.API_BASE_URL ?? "/api",
};
