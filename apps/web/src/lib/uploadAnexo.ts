// Upload de anexos.
//
// Modo `azure` (produção): o navegador envia o arquivo em um único PUT direto ao
// Azure Blob via URL SAS — os bytes NÃO passam pelo servidor. Depois o backend
// registra o anexo (etapa "completar").
// Modo `local` (dev): upload via FormData pelo servidor (caminho legado).

import { api } from "./api";

export interface AnexoResultado {
  id: string;
  nome: string;
  tamanhoKb?: number;
}

type IniciarResp =
  | { modo: "local" }
  | { modo: "azure"; url: string; chave: string };

interface AnexoApi {
  id: string;
  arquivo: { nomeOriginal: string; tamanhoBytes: number | null };
}

function paraResultado(r: AnexoApi): AnexoResultado {
  return {
    id: r.id,
    nome: r.arquivo.nomeOriginal,
    tamanhoKb: r.arquivo.tamanhoBytes ? Math.round(r.arquivo.tamanhoBytes / 1024) : undefined,
  };
}

/** PUT do arquivo direto no Blob via SAS, com progresso (XHR — fetch não reporta upload). */
function putComProgresso(
  url: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("x-ms-blob-type", "BlockBlob");
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Falha no upload ao Blob (HTTP ${xhr.status}).`));
    xhr.onerror = () => reject(new Error("Falha de rede no upload ao Blob."));
    xhr.send(file);
  });
}

/**
 * Envia um arquivo como anexo de uma submissão.
 * @param onProgress callback opcional com o percentual (0–100).
 */
export async function uploadAnexo(
  submissaoId: string,
  file: File,
  perguntaCodigo?: string,
  onProgress?: (pct: number) => void,
): Promise<AnexoResultado> {
  const iniciar = await api.post<IniciarResp>(`/submissoes/${submissaoId}/anexos/iniciar`, {
    nomeOriginal: file.name,
    mimeType: file.type || "application/octet-stream",
    tamanhoBytes: file.size,
    perguntaCodigo,
  });

  // Modo local (dev): upload pelo servidor via FormData.
  if (iniciar.modo === "local") {
    const fd = new FormData();
    fd.append("arquivo", file);
    if (perguntaCodigo) fd.append("perguntaCodigo", perguntaCodigo);
    const r = await api.post<AnexoApi>(`/submissoes/${submissaoId}/anexos`, fd);
    onProgress?.(100);
    return paraResultado(r);
  }

  // Modo Azure: PUT único direto ao Blob via SAS, depois registra o anexo.
  await putComProgresso(iniciar.url, file, onProgress);

  const anexo = await api.post<AnexoApi>(`/submissoes/${submissaoId}/anexos/completar`, {
    chave: iniciar.chave,
    nomeOriginal: file.name,
    mimeType: file.type || "application/octet-stream",
    tamanhoBytes: file.size,
    perguntaCodigo,
  });
  onProgress?.(100);
  return paraResultado(anexo);
}
