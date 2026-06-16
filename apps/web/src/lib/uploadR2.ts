// Upload de anexos com suporte a arquivos grandes (até 50 GB).
//
// No modo S3/R2, o navegador envia o arquivo em PARTES direto ao bucket via
// URLs assinadas (multipart) — os bytes NÃO passam pelo servidor/ngrok/nginx.
// No modo local (dev), cai no upload legado via FormData pelo servidor.

import { api } from "./api";

export interface AnexoResultado {
  id: string;
  nome: string;
  tamanhoKb?: number;
}

type IniciarResp =
  | { modo: "local" }
  | { modo: "s3"; chave: string; uploadId: string; partSize: number };

interface AnexoApi {
  id: string;
  arquivo: { nomeOriginal: string; tamanhoBytes: number | null };
}

/** Concorrência de upload de partes (equilíbrio entre velocidade e memória). */
const CONCORRENCIA = 3;

function paraResultado(r: AnexoApi): AnexoResultado {
  return {
    id: r.id,
    nome: r.arquivo.nomeOriginal,
    tamanhoKb: r.arquivo.tamanhoBytes ? Math.round(r.arquivo.tamanhoBytes / 1024) : undefined,
  };
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
  const iniciar = await api.post<IniciarResp>(
    `/submissoes/${submissaoId}/anexos/multipart/iniciar`,
    {
      nomeOriginal: file.name,
      mimeType: file.type || "application/octet-stream",
      tamanhoBytes: file.size,
      perguntaCodigo,
    },
  );

  // Modo local (dev): upload pelo servidor via FormData.
  if (iniciar.modo === "local") {
    const fd = new FormData();
    fd.append("arquivo", file);
    if (perguntaCodigo) fd.append("perguntaCodigo", perguntaCodigo);
    const r = await api.post<AnexoApi>(`/submissoes/${submissaoId}/anexos`, fd);
    onProgress?.(100);
    return paraResultado(r);
  }

  // Modo S3/R2: multipart direto ao bucket.
  const { chave, uploadId, partSize } = iniciar;
  const totalPartes = Math.max(1, Math.ceil(file.size / partSize));
  const numeros = Array.from({ length: totalPartes }, (_, i) => i + 1);
  const partes: { numero: number; etag: string }[] = [];
  let enviado = 0;
  let proximo = 0;

  async function worker() {
    while (proximo < numeros.length) {
      const numero = numeros[proximo++]!;
      const inicio = (numero - 1) * partSize;
      const fim = Math.min(inicio + partSize, file.size);
      const chunk = file.slice(inicio, fim);

      const { url } = await api.post<{ url: string }>(
        `/submissoes/${submissaoId}/anexos/multipart/assinar-parte`,
        { chave, uploadId, numeroParte: numero },
      );

      const resp = await fetch(url, { method: "PUT", body: chunk });
      if (!resp.ok) throw new Error(`Falha ao enviar a parte ${numero} (HTTP ${resp.status}).`);
      const etag = resp.headers.get("ETag") ?? resp.headers.get("etag");
      if (!etag) {
        throw new Error(
          "O R2 não retornou o ETag da parte. Verifique o CORS do bucket (ExposeHeaders: ETag).",
        );
      }
      // Repassa o ETag exatamente como o R2 retornou (com aspas) ao completar.
      partes.push({ numero, etag });
      enviado += fim - inicio;
      onProgress?.(Math.min(100, Math.round((enviado / Math.max(1, file.size)) * 100)));
    }
  }

  try {
    await Promise.all(
      Array.from({ length: Math.min(CONCORRENCIA, numeros.length) }, () => worker()),
    );
    const anexo = await api.post<AnexoApi>(
      `/submissoes/${submissaoId}/anexos/multipart/completar`,
      {
        chave,
        uploadId,
        nomeOriginal: file.name,
        mimeType: file.type || "application/octet-stream",
        tamanhoBytes: file.size,
        perguntaCodigo,
        partes,
      },
    );
    onProgress?.(100);
    return paraResultado(anexo);
  } catch (e) {
    // Cancelamento/erro: aborta o multipart (libera partes órfãs no R2).
    try {
      await api.post(`/submissoes/${submissaoId}/anexos/multipart/abortar`, { chave, uploadId });
    } catch {
      /* best-effort */
    }
    throw e;
  }
}
