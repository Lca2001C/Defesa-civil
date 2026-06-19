import { api } from "../../../lib/api";
import type { Resumo, TimelineItem, PorRegional, PorFormulario, ExportJobEstado } from "../types";

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

  enfileirarExport: (competenciaId: string) =>
    api.post<{ jobId: string }>(`/relatorios/submissoes/export?competenciaId=${competenciaId}`),

  consultarExport: (jobId: string) =>
    api.get<ExportJobEstado>(`/relatorios/export/${jobId}`),
};
