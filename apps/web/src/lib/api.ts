// Wrapper minimo sobre fetch para falar com a API NestJS.
// A baseUrl e RELATIVA (vinda do runtimeConfig), portanto a SPA sempre usa a
// mesma origem (Nginx faz o proxy reverso para a API). Nenhuma URL fixa.

import { getAccessToken } from "./auth";
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

async function requisitar<T>(
  method: string,
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const temCorpo = body !== undefined;
  const token = getAccessToken();

  const cabecalhos: Record<string, string> = { Accept: "application/json" };
  if (temCorpo) cabecalhos["Content-Type"] = "application/json";
  if (token) cabecalhos["Authorization"] = `Bearer ${token}`;
  if (init?.headers) {
    const extra = new Headers(init.headers as HeadersInit);
    extra.forEach((v, k) => { cabecalhos[k] = v; });
  }

  const resposta = await fetch(montarUrl(path), {
    method,
    headers: cabecalhos,
    body: temCorpo ? JSON.stringify(body) : undefined,
    ...init,
  });

  const texto = await resposta.text();
  let dados: unknown = undefined;
  if (texto) {
    try {
      dados = JSON.parse(texto);
    } catch {
      dados = texto;
    }
  }

  // Token expirado ou invalido: notifica o AuthProvider para limpar sessao.
  if (resposta.status === 401) {
    window.dispatchEvent(new CustomEvent("auth:logout"));
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
};
