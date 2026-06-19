import { api } from "../../../lib/api";
import type { ListagemMunicipios, MunicipioDetalhe, AtualizarCompdecInput } from "../types";

/** Camada de serviço de API da feature de municípios. */
export const MunicipiosService = {
  listar: (nome?: string) =>
    api.get<ListagemMunicipios>(
      `/municipios?porPagina=50${nome ? `&nome=${encodeURIComponent(nome)}` : ""}`,
    ),

  /** Lista enxuta (id IBGE + nome) para seletores. */
  listarParaSelecao: () => api.get<{ id: number; nome: string }[]>("/municipios/lista"),

  buscar: (id: string) => api.get<MunicipioDetalhe>(`/municipios/${id}`),

  atualizarCompdec: (id: string, input: AtualizarCompdecInput) =>
    api.patch(`/municipios/${id}/compdec`, input),
};
