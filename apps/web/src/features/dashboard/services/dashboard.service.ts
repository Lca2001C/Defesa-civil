import { api } from "../../../lib/api";
import { exportarSubmissoes } from "../../../lib/exportSubmissoes";
import type { Resumo, TimelineItem, PorRegional, PorFormulario } from "../types";

/** Camada de serviço de API da feature de dashboard (indicadores + exportação). */
export const DashboardService = {
  resumo: (competenciaId: string) =>
    api.get<Resumo>(`/dashboard/resumo?competenciaId=${competenciaId}`),

  timeline: (competenciaId: string, dias = 30) =>
    api.get<TimelineItem[]>(`/dashboard/timeline?competenciaId=${competenciaId}&dias=${dias}`),

  porRegional: (competenciaId: string) =>
    api.get<PorRegional[]>(`/dashboard/por-regional?competenciaId=${competenciaId}`),

  porFormulario: (competenciaId: string) =>
    api.get<PorFormulario[]>(`/dashboard/por-formulario?competenciaId=${competenciaId}`),

  /** Exporta as submissões da competência em Excel (download direto). */
  exportar: (competenciaId: string) => exportarSubmissoes({ competenciaId }),
};
