export interface Usuario {
  id: string;
  nome: string;
  email: string;
  cpf: string;
  cargo: string | null;
  escopo: string;
  ativo: boolean;
  perfil: { nome: string; codigo: string; nivel: number };
  municipio: { nome: string } | null;
  regional: { nome: string } | null;
}

export interface CriarUsuarioInput {
  nome: string;
  cpf: string;
  email: string;
  senha: string;
  cargo?: string;
  telefone?: string;
  perfilCodigo: string;
  escopo: string;
  municipioId?: number;
}

export interface AtualizarUsuarioInput {
  nome: string;
  cargo?: string;
  telefone?: string;
  // Opcional: só o SUPER_ADMIN envia perfilCodigo (mudar nível de permissão).
  perfilCodigo?: string;
}

export interface LogAuditoria {
  id: string;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  ip: string | null;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  criadoEm: string;
  ator?: { nome: string; email: string } | null;
}

export interface ListagemLogs {
  items: LogAuditoria[];
  total: number;
}
