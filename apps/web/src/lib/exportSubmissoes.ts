// Exportação de submissões em Excel — reusa o pipeline assíncrono (BullMQ) do
// módulo relatorios: enfileira o job com os filtros atuais, faz polling do
// progresso e baixa o .xlsx ao concluir.

import { api } from "./api";
import { getAccessToken } from "./auth";
import { runtimeConfig } from "./runtimeConfig";

export interface FiltrosExport {
  competenciaId?: string;
  formularioVersaoId?: string;
  municipioId?: string;
  regionalId?: string;
  status?: string;
  busca?: string;
  dataInicio?: string;
  dataFim?: string;
}

interface JobEstado {
  estado: string;
  progresso: number;
  resultado: { arquivoId: string; chave: string; nome: string } | null;
}

const ESTADOS_ERRO = new Set(["failed", "stuck", "unknown"]);

function montarQuery(f: FiltrosExport): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v) p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

/**
 * Exporta as submissões que casam com os filtros (respeitando o escopo do
 * usuário no backend) e dispara o download do arquivo .xlsx.
 * @param onProgresso callback opcional com o percentual (0–100) do job.
 */
export async function exportarSubmissoes(
  filtros: FiltrosExport,
  onProgresso?: (pct: number) => void,
): Promise<void> {
  const { jobId } = await api.post<{ jobId: string }>(
    `/relatorios/submissoes/export${montarQuery(filtros)}`,
  );

  // Polling até o job concluir (ou falhar).
  for (;;) {
    const job = await api.get<JobEstado>(`/relatorios/export/${jobId}`);
    onProgresso?.(job.progresso ?? 0);
    if (job.estado === "completed" && job.resultado) break;
    if (ESTADOS_ERRO.has(job.estado)) {
      throw new Error("Falha ao gerar a exportação. Tente novamente.");
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  // Download do .xlsx como blob (precisa do token de acesso no header).
  const base = runtimeConfig.apiBaseUrl.replace(/\/$/, "");
  const token = getAccessToken();
  const resp = await fetch(`${base}/relatorios/export/${jobId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) throw new Error(`Falha no download (HTTP ${resp.status}).`);

  const blob = await resp.blob();
  const nomeArquivo =
    resp.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1] ??
    "submissoes.xlsx";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
