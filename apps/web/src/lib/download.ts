// Helper de download autenticado de arquivos (export Excel/PDF).
//
// Diferente do `api.ts` (que lida com JSON), aqui baixamos um blob binário.
// Centraliza: header Authorization, tratamento de 401 (encerra a sessão),
// extração da mensagem de erro do backend e do nome do arquivo (RFC 5987),
// e o gatilho de download no navegador.

import { getAccessToken, clearTokens } from "./auth";
import { runtimeConfig } from "./runtimeConfig";

/** Extrai o filename do Content-Disposition (prioriza filename* RFC 5987). */
function nomeDoContentDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const rfc5987 = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (rfc5987?.[1]) {
    try {
      return decodeURIComponent(rfc5987[1]);
    } catch {
      /* cai no filename simples */
    }
  }
  const simples = header.match(/filename="?([^"]+)"?/i);
  return simples?.[1] ?? fallback;
}

/**
 * Baixa um arquivo de um endpoint autenticado e dispara o download.
 * @throws Error com a mensagem do backend (quando houver) em caso de falha.
 */
export async function baixarArquivoAutenticado(
  path: string,
  fallbackName: string,
  init?: RequestInit,
): Promise<void> {
  const base = runtimeConfig.apiBaseUrl.replace(/\/$/, "");
  const token = getAccessToken();
  const caminho = path.startsWith("/") ? path : `/${path}`;

  const resp = await fetch(`${base}${caminho}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  // Sessão expirada: encerra como o api.ts faz, para a UI redirecionar ao login.
  if (resp.status === 401) {
    clearTokens();
    window.dispatchEvent(new CustomEvent("auth:logout"));
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  if (!resp.ok) {
    let detalhe = `HTTP ${resp.status}`;
    try {
      const corpo = await resp.json();
      if (corpo && typeof corpo.message === "string") detalhe = corpo.message;
    } catch {
      /* corpo não-JSON */
    }
    throw new Error(detalhe);
  }

  const blob = await resp.blob();
  const nome = nomeDoContentDisposition(resp.headers.get("Content-Disposition"), fallbackName);

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
