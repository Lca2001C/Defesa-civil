import { api } from "../../../lib/api";
import type { Usuario, CriarUsuarioInput, AtualizarUsuarioInput } from "../types";

/** Camada de serviço de API para gestão de usuários (admin). */
export const UsuariosService = {
  listar: (ativo: string) => api.get<Usuario[]>(`/usuarios?ativo=${ativo}`),

  ativar: (id: string) => api.patch(`/usuarios/${id}/ativar`, {}),

  desativar: (id: string) => api.patch(`/usuarios/${id}/desativar`, {}),

  excluir: (id: string) => api.delete(`/usuarios/${id}`),

  criar: (input: CriarUsuarioInput) => api.post("/usuarios", input),

  atualizar: (id: string, input: AtualizarUsuarioInput) => api.patch(`/usuarios/${id}`, input),
};
