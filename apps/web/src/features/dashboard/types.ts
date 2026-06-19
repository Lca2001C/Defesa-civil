export interface Resumo {
  total: number;
  rascunho: number;
  emPreenchimento: number;
  enviada: number;
  correcaoSolicitada: number;
  revisada: number;
  aprovada: number;
  respondidas: number;
  percentualCobertura: number;
}

export interface TimelineItem {
  data: string;
  enviadas: number;
  aprovadas: number;
}

export interface PorRegional {
  id: string;
  nome: string;
  total: number;
  aprovadas: number;
}

export interface PorFormulario {
  formularioVersaoId: string;
  formularioId: string;
  nome: string;
  versao: number;
  total: number;
  aprovadas: number;
}

export interface ExportJobEstado {
  estado: string;
  progresso: number;
}
