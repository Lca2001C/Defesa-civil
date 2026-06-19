import { api } from "../../../lib/api";
import type { MunicipioStatus, Estatisticas, DrawerMunicipio } from "../types";

/** Camada de serviço de API da feature de painel (mapa em tempo real). */
export const PainelService = {
  status: (competenciaId: string) =>
    api.get<MunicipioStatus[]>(`/painel/status?competenciaId=${competenciaId}`),

  stats: (competenciaId: string) =>
    api.get<Estatisticas>(`/painel/stats?competenciaId=${competenciaId}`),

  drawer: (municipioId: number, competenciaId: string) =>
    api.get<DrawerMunicipio>(`/painel/municipio/${municipioId}?competenciaId=${competenciaId}`),
};
