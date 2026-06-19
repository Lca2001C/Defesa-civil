import { api } from "../../../lib/api";
import type { TokensResposta, TermoLgpd, RegistrarPayload } from "../types";

/** Camada de serviço de API de autenticação (login, registro, recuperação de senha). */
export const AuthService = {
  login: (email: string, senha: string) =>
    api.post<TokensResposta>("/auth/login", { email, senha }),

  registrar: (payload: RegistrarPayload) =>
    api.post<TokensResposta>("/auth/registrar", payload),

  termoAtual: () => api.get<TermoLgpd>("/auth/termos-lgpd/atual"),

  solicitarRecuperacao: (email: string) =>
    api.post("/auth/recuperar-senha/solicitar", { email }),

  redefinirSenha: (token: string, novaSenha: string) =>
    api.post("/auth/recuperar-senha/redefinir", { token, novaSenha }),
};
