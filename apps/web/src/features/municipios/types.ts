export interface MunicipioLista {
  id: number;
  nome: string;
  regional: { id: string; nome: string } | null;
  compdec: { coordenadorNome?: string | null; telefone?: string | null; email?: string | null } | null;
}

export interface ListagemMunicipios {
  items: MunicipioLista[];
  total: number;
  totalPaginas: number;
}

export interface MunicipioDetalhe {
  id: number;
  nome: string;
  compdec: { id: string; coordenadorNome: string | null; telefone: string | null; email: string | null } | null;
  regional: { nome: string } | null;
  uf: { sigla: string; nome: string };
}

export interface AtualizarCompdecInput {
  coordenadorNome: string;
  telefone: string;
  email: string;
}
