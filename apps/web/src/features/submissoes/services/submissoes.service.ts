import { api } from "../../../lib/api";
import { baixarArquivoAutenticado } from "../../../lib/download";
import type { ListagemSubmissoes, SubmissaoCompleta, CriarSubmissaoPayload } from "../types";

/** Camada de serviço de API da feature de submissões. */
export const SubmissoesService = {
  listar: (queryString: string) => api.get<ListagemSubmissoes>(`/submissoes?${queryString}`),

  buscar: (id: string) => api.get<SubmissaoCompleta>(`/submissoes/${id}`),

  criar: (payload: CriarSubmissaoPayload) =>
    api.post<{ id: string; protocolo: string }>("/submissoes", payload),

  atualizarDados: (id: string, dados: Record<string, unknown>) =>
    api.patch(`/submissoes/${id}`, { dados }),

  enviar: (id: string) => api.patch(`/submissoes/${id}/enviar`, {}),

  /** Transições de revisão: solicitar-correcao | revisar | aprovar. */
  acao: (id: string, acao: string, comentario?: string) =>
    api.patch(`/submissoes/${id}/${acao}`, { comentario: comentario || undefined }),

  excluir: (id: string) => api.delete(`/submissoes/${id}`),

  removerAnexo: (id: string, anexoId: string) =>
    api.del(`/submissoes/${id}/anexos/${anexoId}`),

  /** Baixa a submissão como documento (PDF ou Excel) — download autenticado. */
  baixarExport(id: string, formato: "pdf" | "xlsx"): Promise<void> {
    return baixarArquivoAutenticado(
      `/submissoes/${id}/export?formato=${formato}`,
      `submissao.${formato}`,
    );
  },
};
