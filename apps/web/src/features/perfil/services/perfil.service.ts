import { api } from "../../../lib/api";
import type { PerfilData, AtualizarPerfilInput } from "../types";

/** Camada de serviço de API da feature de perfil (dados do próprio usuário). */
export const PerfilService = {
  buscarMe: () => api.get<PerfilData>("/usuarios/me"),

  atualizarMe: (input: AtualizarPerfilInput) => api.patch("/usuarios/me", input),

  alterarSenha: (usuarioId: string, novaSenha: string) =>
    api.patch(`/usuarios/${usuarioId}/senha`, { novaSenha }),
};
