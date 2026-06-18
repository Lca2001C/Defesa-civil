export type CompetenciaStatus = "PLANEJADA" | "ABERTA" | "ENCERRADA";

export interface Competencia {
  id: string;
  nome: string;
  ano: number;
  dataInicio: string;
  dataFim: string;
  status: CompetenciaStatus;
}

export interface CriarCompetenciaInput {
  nome: string;
  ano: number;
  dataInicio: string;
  dataFim: string;
}
