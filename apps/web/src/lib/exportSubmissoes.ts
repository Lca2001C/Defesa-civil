// Exportação de submissões em Excel — geração SÍNCRONA no backend: um único
// POST devolve o arquivo .xlsx direto na resposta, que é baixado como blob.

import { baixarArquivoAutenticado } from "./download";

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
 */
export function exportarSubmissoes(filtros: FiltrosExport): Promise<void> {
  return baixarArquivoAutenticado(
    `/relatorios/submissoes/export${montarQuery(filtros)}`,
    "submissoes.xlsx",
    { method: "POST" },
  );
}
