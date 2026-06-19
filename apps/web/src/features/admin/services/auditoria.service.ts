import { api } from "../../../lib/api";
import type { ListagemLogs } from "../types";

/** Camada de serviço de API para os logs de auditoria (admin). */
export const AuditoriaService = {
  listar: (entidade?: string) =>
    api.get<ListagemLogs>(`/auditoria?porPagina=50${entidade ? `&entidade=${entidade}` : ""}`),
};
