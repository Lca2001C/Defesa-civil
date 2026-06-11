// Store de autenticacao (localStorage) — sem dependencia de React.
// A api.ts le getAccessToken() em cada requisicao; o AuthContext
// consome as funcoes de leitura/escrita para manter o estado reativo.

export interface UsuarioLogado {
  sub: string;
  email: string;
  perfilCodigo: string;
  perfilNivel: number;
  escopo: string;
  ufId: number | null;
  regionalId: string | null;
  municipioId: number | null;
  permissoes: string[];
  exp?: number;
}

const CHAVE_ACCESS = 'dcmg_access_token';
const CHAVE_REFRESH = 'dcmg_refresh_token';

export function getAccessToken(): string | null {
  return localStorage.getItem(CHAVE_ACCESS);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(CHAVE_REFRESH);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(CHAVE_ACCESS, accessToken);
  localStorage.setItem(CHAVE_REFRESH, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(CHAVE_ACCESS);
  localStorage.removeItem(CHAVE_REFRESH);
}

/** Decodifica o payload do JWT sem verificar assinatura (client-side only). */
export function decodificarToken(token: string): UsuarioLogado | null {
  try {
    const partes = token.split('.');
    if (partes.length !== 3) return null;
    const payload = partes[1]!
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    return JSON.parse(atob(payload)) as UsuarioLogado;
  } catch {
    return null;
  }
}

export function getUsuario(): UsuarioLogado | null {
  const token = getAccessToken();
  if (!token) return null;
  const payload = decodificarToken(token);
  // Verifica expiracao (exp em segundos UNIX).
  if (payload?.exp && payload.exp * 1000 < Date.now()) {
    clearTokens();
    return null;
  }
  return payload;
}

export function temPermissao(chave: string): boolean {
  return getUsuario()?.permissoes.includes(chave) ?? false;
}
