import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';

export type UsuarioComPerfil = Prisma.UsuarioGetPayload<{
  include: { perfil: { include: { permissoes: true } } };
}>;

const INCLUDE_PERFIL = { perfil: { include: { permissoes: true } } } as const;

const PERFIL_OPERADOR = 'OPERADOR_MUNICIPAL';
const PERFIL_COORD_COMPDEC = 'COORDENADOR_COMPDEC';
const PERMISSOES_COORD = ['painel.ver', 'submissoes.criar', 'submissoes.editar', 'relatorios.exportar'];
const NIVEL_COORD = 25;
const UF_MG_ID = 31;

interface DadosRegistro {
  nome: string;
  cpf: string;
  email: string;
  senhaHash: string;
  telefone: string;
  perfilId: string;
  municipioId: number | null;
  ehCoordenadorCompdec: boolean;
  versaoTermoAceito: string;
  ip: string;
  userAgent?: string;
}

/** Acesso a dados de autenticação/identidade (única camada que toca o Prisma). */
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  buscarPorEmailComPerfil(email: string): Promise<UsuarioComPerfil | null> {
    return this.prisma.usuario.findUnique({ where: { email }, include: INCLUDE_PERFIL });
  }

  buscarAtivoPorIdComPerfil(id: string): Promise<UsuarioComPerfil | null> {
    return this.prisma.usuario.findUnique({ where: { id, ativo: true }, include: INCLUDE_PERFIL });
  }

  /** Fire-and-forget: atualiza o carimbo de último acesso. */
  marcarUltimoAcesso(id: string): void {
    void this.prisma.usuario.update({ where: { id }, data: { ultimoAcessoEm: new Date() } });
  }

  // ── Registro ───────────────────────────────────────────────────────────────

  async emailExiste(email: string): Promise<boolean> {
    return !!(await this.prisma.usuario.findUnique({ where: { email } }));
  }

  async cpfExiste(cpf: string): Promise<boolean> {
    return !!(await this.prisma.usuario.findUnique({ where: { cpf } }));
  }

  /** Resolve o perfil do registro; cria/corrige COORDENADOR_COMPDEC se necessário. */
  async resolverPerfilRegistro(ehCoordenador: boolean): Promise<{ id: string } | null> {
    const codigoPerfil = ehCoordenador ? PERFIL_COORD_COMPDEC : PERFIL_OPERADOR;
    let perfil = await this.prisma.perfil.findUnique({
      where: { codigo: codigoPerfil },
      include: { permissoes: true },
    });

    if (!perfil && codigoPerfil === PERFIL_COORD_COMPDEC) {
      const permissoesBasicas = await this.prisma.permissao.findMany({
        where: { chave: { in: PERMISSOES_COORD } },
      });
      const connect = permissoesBasicas.map((p) => ({ chave: p.chave }));
      perfil = await this.prisma.perfil.upsert({
        where: { codigo: PERFIL_COORD_COMPDEC },
        create: { codigo: PERFIL_COORD_COMPDEC, nome: 'Coordenador COMPDEC', nivel: NIVEL_COORD, permissoes: { connect } },
        update: { nome: 'Coordenador COMPDEC', nivel: NIVEL_COORD, permissoes: { set: connect } },
        include: { permissoes: true },
      });
    }

    return perfil ? { id: perfil.id } : null;
  }

  async termoExiste(versao: string): Promise<boolean> {
    return !!(await this.prisma.termoLgpd.findUnique({ where: { versao } }));
  }

  async municipioExiste(id: number): Promise<boolean> {
    return !!(await this.prisma.municipio.findUnique({ where: { id } }));
  }

  async criarUsuarioComAceite(dados: DadosRegistro): Promise<UsuarioComPerfil> {
    const novo = await this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          nome: dados.nome,
          cpf: dados.cpf,
          email: dados.email,
          senhaHash: dados.senhaHash,
          telefone: dados.telefone,
          perfilId: dados.perfilId,
          escopo: 'MUNICIPAL',
          ufId: UF_MG_ID,
          municipioId: dados.municipioId,
        },
      });

      await tx.aceiteTermoLgpd.create({
        data: {
          usuarioId: usuario.id,
          email: dados.email,
          ip: dados.ip,
          userAgent: dados.userAgent ?? null,
          versaoTermo: dados.versaoTermoAceito,
        },
      });

      if (dados.ehCoordenadorCompdec && dados.municipioId) {
        await tx.compdec.upsert({
          where: { municipioId: dados.municipioId },
          create: {
            municipioId: dados.municipioId,
            coordenadorNome: dados.nome,
            telefone: dados.telefone,
            email: dados.email,
          },
          update: { coordenadorNome: dados.nome, telefone: dados.telefone, email: dados.email },
        });
      }

      return usuario;
    });

    return this.prisma.usuario.findUniqueOrThrow({ where: { id: novo.id }, include: INCLUDE_PERFIL });
  }

  // ── Termos LGPD ──────────────────────────────────────────────────────────────

  buscarTermoAtivo(): Promise<{ versao: string; conteudo: string } | null> {
    return this.prisma.termoLgpd.findFirst({
      where: { ativo: true },
      orderBy: { criadoEm: 'desc' },
      select: { versao: true, conteudo: true },
    });
  }

  // ── Recuperação de senha ─────────────────────────────────────────────────────

  buscarParaRecuperacao(email: string): Promise<{ id: string; nome: string; ativo: boolean } | null> {
    return this.prisma.usuario.findUnique({
      where: { email },
      select: { id: true, nome: true, ativo: true },
    });
  }

  async invalidarRecuperacoesAnteriores(email: string): Promise<void> {
    await this.prisma.recuperacaoSenha.updateMany({
      where: { email, usadoEm: null },
      data: { usadoEm: new Date() },
    });
  }

  async criarRecuperacao(email: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.prisma.recuperacaoSenha.create({ data: { email, tokenHash, expiresAt } });
  }

  buscarRecuperacao(
    tokenHash: string,
  ): Promise<{ email: string; usadoEm: Date | null; expiresAt: Date } | null> {
    return this.prisma.recuperacaoSenha.findUnique({
      where: { tokenHash },
      select: { email: true, usadoEm: true, expiresAt: true },
    });
  }

  async redefinirSenhaPorToken(email: string, senhaHash: string, tokenHash: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.usuario.update({ where: { email }, data: { senhaHash } }),
      this.prisma.recuperacaoSenha.update({ where: { tokenHash }, data: { usadoEm: new Date() } }),
    ]);
  }

  async buscarIdPorEmail(email: string): Promise<string | null> {
    const u = await this.prisma.usuario.findUnique({ where: { email }, select: { id: true } });
    return u?.id ?? null;
  }
}
