export interface PerfilData {
  id: string;
  nome: string;
  email: string;
  cpf: string;
  cargo: string | null;
  telefone: string | null;
  escopo: string;
  ativo: boolean;
  ultimoAcessoEm: string | null;
  criadoEm: string;
  perfil: { nome: string; codigo: string; nivel: number };
  municipio: { id: number; nome: string } | null;
  regional: { nome: string } | null;
  uf: { sigla: string } | null;
  _count: { submissoes: number };
}

export interface AtualizarPerfilInput {
  nome: string;
  cargo?: string;
  telefone?: string;
}
