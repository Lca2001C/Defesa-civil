import { Injectable } from '@nestjs/common';
import { EscopoUsuario, Prisma, Usuario } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';

interface FiltrosUsuario {
  municipioId?: number;
  regionalId?: string;
  ativo?: boolean;
}

interface DadosCriarUsuario {
  nome: string;
  cpf: string;
  email: string;
  senhaHash: string;
  cargo?: string;
  telefone?: string;
  escopo: EscopoUsuario;
  ufId: number | null;
  regionalId: string | null;
  municipioId: number | null;
  perfilId: string;
}

interface DadosAtualizarUsuario {
  nome?: string;
  cargo?: string;
  telefone?: string;
  perfilId?: string;
}

const SELECT_RESUMO = { id: true, nome: true, email: true, escopo: true, ativo: true } as const;

/** Acesso a dados de Usuário/Perfil (única camada que toca o Prisma). */
@Injectable()
export class UsuariosRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Dados pessoais (LGPD) ───────────────────────────────────────────────────

  buscarCadastroLgpd(usuarioId: string) {
    return this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true, nome: true, email: true, cpf: true, cargo: true, telefone: true,
        escopo: true, ativo: true, ultimoAcessoEm: true, criadoEm: true,
        perfil: { select: { nome: true, codigo: true } },
        municipio: { select: { nome: true, id: true } },
        regional: { select: { nome: true } },
        uf: { select: { sigla: true } },
      },
    });
  }

  listarSubmissoesLgpd(autorId: string) {
    return this.prisma.submissao.findMany({
      where: { autorId },
      orderBy: { criadoEm: 'desc' },
      take: 100,
      select: {
        id: true, protocolo: true, status: true, criadoEm: true,
        nomeRespondente: true, cargoRespondente: true, emailRespondente: true,
        telefoneRespondente: true, cpfRespondente: true,
        municipio: { select: { nome: true } },
        formularioVersao: { select: { versao: true, formulario: { select: { nome: true } } } },
      },
    });
  }

  listarLogsLgpd(atorId: string) {
    return this.prisma.logAuditoria.findMany({
      where: { atorId },
      orderBy: { criadoEm: 'desc' },
      take: 50,
      select: { id: true, acao: true, entidade: true, entidadeId: true, criadoEm: true },
    });
  }

  // ── Leitura ─────────────────────────────────────────────────────────────────

  buscarMe(usuarioId: string) {
    return this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true, nome: true, email: true, cpf: true, cargo: true, telefone: true,
        escopo: true, ativo: true, ultimoAcessoEm: true, criadoEm: true,
        perfil: { select: { nome: true, codigo: true, nivel: true } },
        municipio: { select: { id: true, nome: true } },
        regional: { select: { nome: true } },
        uf: { select: { sigla: true } },
        _count: { select: { submissoes: true } },
      },
    });
  }

  listar(filtros: FiltrosUsuario, escopoWhere: Prisma.UsuarioWhereInput = {}) {
    return this.prisma.usuario.findMany({
      where: {
        ...(filtros.municipioId !== undefined ? { municipioId: filtros.municipioId } : {}),
        ...(filtros.regionalId ? { regionalId: filtros.regionalId } : {}),
        ...(filtros.ativo !== undefined ? { ativo: filtros.ativo } : {}),
        // Escopo do solicitante (sempre por cima — nunca amplia).
        ...escopoWhere,
      },
      select: {
        id: true, nome: true, email: true, cpf: true, cargo: true,
        escopo: true, ativo: true, ultimoAcessoEm: true, criadoEm: true,
        perfil: { select: { nome: true, codigo: true, nivel: true } },
        municipio: { select: { nome: true, id: true } },
        regional: { select: { nome: true, id: true } },
        uf: { select: { sigla: true } },
      },
      orderBy: { nome: 'asc' },
    });
  }

  buscarDetalhado(id: string) {
    return this.prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true, nome: true, email: true, cpf: true, cargo: true, telefone: true,
        escopo: true, ativo: true, ultimoAcessoEm: true, criadoEm: true,
        perfil: { include: { permissoes: { select: { chave: true } } } },
        municipio: { select: { nome: true, id: true } },
        regional: { select: { nome: true, id: true } },
        uf: { select: { sigla: true, nome: true } },
      },
    });
  }

  buscarPorId(id: string): Promise<Usuario | null> {
    return this.prisma.usuario.findUnique({ where: { id } });
  }

  async emailExiste(email: string): Promise<boolean> {
    return !!(await this.prisma.usuario.findUnique({ where: { email } }));
  }

  async cpfExiste(cpf: string): Promise<boolean> {
    return !!(await this.prisma.usuario.findUnique({ where: { cpf } }));
  }

  async buscarPerfilIdPorCodigo(codigo: string): Promise<string | null> {
    const perfil = await this.prisma.perfil.findUnique({ where: { codigo } });
    return perfil?.id ?? null;
  }

  /** Perfil (id + nível) por código — usado para checar teto de nível na gestão de usuários. */
  async buscarPerfilPorCodigo(codigo: string): Promise<{ id: string; nivel: number } | null> {
    const perfil = await this.prisma.perfil.findUnique({
      where: { codigo },
      select: { id: true, nivel: true },
    });
    return perfil ?? null;
  }

  /** regionalId do município (para checagem de escopo REGIONAL na gestão de usuários). */
  async buscarRegionalDoMunicipio(municipioId: number): Promise<string | null | undefined> {
    const m = await this.prisma.municipio.findUnique({
      where: { id: municipioId },
      select: { regionalId: true },
    });
    return m?.regionalId;
  }

  async perfilEhSuperAdmin(perfilId: string): Promise<boolean> {
    const perfil = await this.prisma.perfil.findUnique({ where: { id: perfilId } });
    return perfil?.codigo === 'SUPER_ADMIN';
  }

  contarSuperAdminsAtivos(): Promise<number> {
    return this.prisma.usuario.count({ where: { perfil: { codigo: 'SUPER_ADMIN' }, ativo: true } });
  }

  contarSubmissoesDoAutor(autorId: string): Promise<number> {
    return this.prisma.submissao.count({ where: { autorId } });
  }

  // ── Escrita ─────────────────────────────────────────────────────────────────

  criar(dados: DadosCriarUsuario) {
    return this.prisma.usuario.create({
      data: { ...dados, ativo: true },
      select: SELECT_RESUMO,
    });
  }

  atualizarPerfilProprio(
    id: string,
    dados: { nome?: string; cargo?: string; telefone?: string },
  ) {
    return this.prisma.usuario.update({
      where: { id },
      data: dados,
      select: { id: true, nome: true, cargo: true, telefone: true },
    });
  }

  atualizar(id: string, dados: DadosAtualizarUsuario) {
    return this.prisma.usuario.update({ where: { id }, data: dados, select: SELECT_RESUMO });
  }

  definirAtivo(id: string, ativo: boolean) {
    return this.prisma.usuario.update({
      where: { id },
      data: { ativo },
      select: { id: true, ativo: true },
    });
  }

  async atualizarSenha(id: string, senhaHash: string): Promise<void> {
    await this.prisma.usuario.update({ where: { id }, data: { senhaHash } });
  }

  /** Invalida a sessão ativa do usuário (remove o refresh token persistido). */
  async invalidarSessoes(id: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { usuarioId: id } });
  }

  async remover(id: string): Promise<void> {
    await this.prisma.usuario.delete({ where: { id } });
  }
}
