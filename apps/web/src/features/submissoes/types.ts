import type { SchemaFormulario } from "@dcmg/contracts";

export interface SubmissaoLista {
  id: string;
  protocolo: string;
  status: string;
  nomeRespondente: string;
  criadoEm: string;
  enviadoEm: string | null;
  municipio: { id: number; nome: string; regional: { nome: string } | null };
  competencia: { nome: string } | null;
  formularioVersao: { versao: number; formulario: { nome: string } };
  autor: { nome: string } | null;
  _count: { historico: number; anexos: number };
}

export interface ListagemSubmissoes {
  items: SubmissaoLista[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
}

export interface CriarSubmissaoPayload {
  formularioVersaoId: string;
  competenciaId: string;
  municipioId: number;
  dados: Record<string, unknown>;
  enviarImediatamente: boolean;
}

export interface HistoricoItem {
  id: string;
  acao: string;
  comentario: string | null;
  criadoEm: string;
  autor: { nome: string };
}

export interface Anexo {
  id: string;
  arquivo: { nomeOriginal: string; mimeType: string | null; tamanhoBytes: number | null };
}

export interface SubmissaoCompleta {
  id: string;
  protocolo: string;
  status: string;
  nomeRespondente: string;
  cpfRespondente: string;
  cargoRespondente: string | null;
  emailRespondente: string | null;
  criadoEm: string;
  enviadoEm: string | null;
  aprovadoEm: string | null;
  dados: Record<string, unknown>;
  schema: SchemaFormulario;
  municipio: { nome: string; uf: { sigla: string } };
  formularioVersao: { versao: number; formulario: { nome: string } };
  competencia: { nome: string; status: string };
  autor: { nome: string; email: string };
  historico: HistoricoItem[];
  anexos: Anexo[];
}
