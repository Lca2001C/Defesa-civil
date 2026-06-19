import { api } from "../../../lib/api";
import type { Competencia, CriarCompetenciaInput } from "../types";

/**
 * Camada de serviço de API da feature de competências.
 * Centraliza as chamadas HTTP — os componentes consomem apenas estes métodos.
 */
export const CompetenciasService = {
  listar: () =>
    api.get<{ items: Competencia[] }>("/competencias?porPagina=100").then((r) => r.items),

  listarAbertas: () =>
    api
      .get<{ items: Competencia[] }>("/competencias?status=ABERTA&porPagina=100")
      .then((r) => r.items),

  criar: (dados: CriarCompetenciaInput) => api.post("/competencias", dados),

  abrir: (id: string) => api.patch(`/competencias/${id}/abrir`, {}),

  encerrar: (id: string) => api.patch(`/competencias/${id}/encerrar`, {}),
};
