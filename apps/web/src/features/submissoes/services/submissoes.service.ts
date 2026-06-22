import { api } from "../../../lib/api";
import { getAccessToken } from "../../../lib/auth";
import { runtimeConfig } from "../../../lib/runtimeConfig";
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

  /** Baixa a submissão como documento (PDF ou Excel) — fetch autenticado + blob. */
  async baixarExport(id: string, formato: "pdf" | "xlsx"): Promise<void> {
    const base = runtimeConfig.apiBaseUrl.replace(/\/$/, "");
    const token = getAccessToken();
    const resp = await fetch(`${base}/submissoes/${id}/export?formato=${formato}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!resp.ok) throw new Error(`Falha ao baixar a submissão (HTTP ${resp.status}).`);

    const blob = await resp.blob();
    const nome =
      resp.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1] ??
      `submissao.${formato}`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
