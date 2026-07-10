import type { SchemaFormulario } from "@dcmg/contracts";

export interface Formulario {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  status: string;
  _count: { versoes: number };
  criadoEm: string;
}

export interface ListagemFormularios {
  items: Formulario[];
  total: number;
  pagina: number;
  totalPaginas: number;
}

export interface Template {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
}

export interface CriacaoResp {
  id: string;
  versaoInicialId: string;
}

/** Contagens do preview de importação. */
export interface ResumoImportacao {
  secoes: number;
  perguntas: number;
  listas: number;
  regras: number;
}

/** Resposta do preview de importação via Excel. */
export interface ResultadoImportacao {
  nome: string;
  schema: SchemaFormulario;
  resumo: ResumoImportacao;
  erros: string[];
}

export interface VersaoResumo {
  id: string;
  versao: number;
  status: string;
  publicadoEm: string | null;
  competencia: { id: string; nome: string; status: string } | null;
  _count: { submissoes: number };
}

export interface FormularioDetalheData {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  status: string;
  versoes: VersaoResumo[];
}

export interface VersaoData {
  id: string;
  versao: number;
  status: string;
  competenciaId: string | null;
  formulario: { id: string; nome: string };
  schema: SchemaFormulario;
}

export interface CriarFormularioInput {
  nome: string;
  descricao?: string;
  categoria?: string;
}

export interface VersaoPublicada {
  id: string;
  versao: number;
  formulario: { id: string; nome: string };
  competencia: { id: string; nome: string } | null;
}
