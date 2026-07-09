import type { SchemaFormulario } from "@dcmg/contracts";
import { api } from "../../../lib/api";
import { baixarArquivoAutenticado } from "../../../lib/download";
import type {
  ListagemFormularios,
  Template,
  CriacaoResp,
  FormularioDetalheData,
  VersaoData,
  CriarFormularioInput,
  VersaoPublicada,
} from "../types";

/** Camada de serviço de API da feature de formulários (CRUD + versões + templates). */
export const FormulariosService = {
  listar: () => api.get<ListagemFormularios>("/formularios?porPagina=50"),

  excluir: (id: string) => api.delete(`/formularios/${id}`),

  listarTemplates: () => api.get<Template[]>("/formularios/templates"),

  listarVersoesPublicadas: () =>
    api.get<VersaoPublicada[]>("/formularios/versoes/publicadas"),

  criar: (input: CriarFormularioInput) => api.post<CriacaoResp>("/formularios", input),

  criarDeTemplate: (templateId: string) =>
    api.post<CriacaoResp>(`/formularios/from-template/${templateId}`),

  /** Baixa a planilha-modelo (.xlsx) para preencher e importar. */
  baixarModeloImportacao: () =>
    baixarArquivoAutenticado(
      "/formularios/modelo-importacao",
      "modelo-formulario-compdec.xlsx",
      { method: "GET" },
    ),

  /** Importa um formulário a partir de uma planilha (.xlsx). */
  importarExcel: (arquivo: File) => {
    const form = new FormData();
    form.append("arquivo", arquivo);
    return api.post<CriacaoResp>("/formularios/importar-excel", form);
  },

  buscar: (id: string) => api.get<FormularioDetalheData>(`/formularios/${id}`),

  buscarVersao: (id: string, versaoId: string) =>
    api.get<VersaoData>(`/formularios/${id}/versoes/${versaoId}`),

  salvarVersao: (id: string, versaoId: string, schema: SchemaFormulario) =>
    api.put<VersaoData>(`/formularios/${id}/versoes/${versaoId}`, { schema }),

  publicarVersao: (id: string, versaoId: string, competenciaId: string) =>
    api.patch(`/formularios/${id}/versoes/${versaoId}/publicar`, { competenciaId }),
};
