// Wrapper minimo sobre fetch para falar com a API NestJS.
// A baseUrl e RELATIVA (vinda do runtimeConfig), portanto a SPA sempre usa a
// mesma origem (Nginx faz o proxy reverso para a API). Nenhuma URL fixa.

import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "./auth";
import { runtimeConfig } from "./runtimeConfig";

/** Erro de requisicao com status HTTP e corpo bruto da resposta. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function montarUrl(path: string): string {
  const base = runtimeConfig.apiBaseUrl.replace(/\/$/, "");
  const caminho = path.startsWith("/") ? path : `/${path}`;
  return `${base}${caminho}`;
}

// Flag para evitar loop de refresh concorrente.
let refreshPromise: Promise<boolean> | null = null;

async function tentarRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
      const resp = await fetch(montarUrl("/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!resp.ok) return false;
      const dados = await resp.json() as { accessToken: string; refreshToken: string };
      setTokens(dados.accessToken, dados.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function requisitar<T>(
  method: string,
  path: string,
  body?: unknown,
  init?: RequestInit,
  _tentativa = 0,
): Promise<T> {
  const temCorpo = body !== undefined;
  const isFormData = body instanceof FormData;
  const token = getAccessToken();

  const cabecalhos: Record<string, string> = { Accept: "application/json" };
  // Não definir Content-Type para FormData: o browser adiciona o boundary automaticamente.
  if (temCorpo && !isFormData) cabecalhos["Content-Type"] = "application/json";
  if (token) cabecalhos["Authorization"] = `Bearer ${token}`;
  if (init?.headers) {
    const extra = new Headers(init.headers as HeadersInit);
    extra.forEach((v, k) => { cabecalhos[k] = v; });
  }

  const resposta = await fetch(montarUrl(path), {
    method,
    headers: cabecalhos,
    body: isFormData ? body : temCorpo ? JSON.stringify(body) : undefined,
    ...init,
  });

  // Tentativa silenciosa de refresh ao receber 401 (access token expirado).
  if (resposta.status === 401 && _tentativa === 0) {
    const renovado = await tentarRefresh();
    if (renovado) {
      return requisitar<T>(method, path, body, init, 1);
    }
    // Refresh falhou: encerra sessao.
    clearTokens();
    window.dispatchEvent(new CustomEvent("auth:logout"));
    throw new ApiError(401, "Sessão expirada. Faça login novamente.");
  }

  const texto = await resposta.text();
  let dados: unknown = undefined;
  if (texto) {
    try {
      dados = JSON.parse(texto);
    } catch {
      dados = texto;
    }
  }

  if (!resposta.ok) {
    let mensagem = `Falha na requisicao (${resposta.status})`;
    if (dados && typeof dados === "object" && "message" in dados) {
      mensagem = String((dados as { message: unknown }).message);
    }
    throw new ApiError(resposta.status, mensagem, dados);
  }

  return dados as T;
}

export const api = {
  get: <T>(path: string, init?: RequestInit) =>
    requisitar<T>("GET", path, undefined, init),
  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    requisitar<T>("POST", path, body, init),
  put: <T>(path: string, body?: unknown, init?: RequestInit) =>
    requisitar<T>("PUT", path, body, init),
  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    requisitar<T>("PATCH", path, body, init),
  del: <T>(path: string, init?: RequestInit) =>
    requisitar<T>("DELETE", path, undefined, init),
  delete: <T>(path: string, init?: RequestInit) =>
    requisitar<T>("DELETE", path, undefined, init),
};
