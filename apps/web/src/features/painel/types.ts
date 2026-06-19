export interface MunicipioStatus {
  municipioId: number;
  codigoIbge: string;
  nome: string;
  status: "RESPONDIDO" | "EM_PREENCHIMENTO" | "NAO_RESPONDEU";
}

export interface Estatisticas {
  respondido: number;
  emPreenchimento: number;
  naoRespondeu: number;
  total: number;
  percentual: number;
}

export interface DrawerMunicipio {
  municipio: { id: number; nome: string; codigoIbge: string };
  compdec: { coordenadorNome?: string; telefone?: string; email?: string } | null;
  submissoesRecentes: Array<{
    id: string;
    protocolo?: string;
    status: string;
    createdAt: string;
    nomeRespondente?: string;
  }>;
}
