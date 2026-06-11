import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { JwtPayload } from '../../common/types/jwt-payload';
import type { CriarUsuarioDto } from './dto/criar-usuario.dto';
import type { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto';

function mascaraCpf(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '***.$2.$3-**');
}

/**
 * Serviço de usuários.
 *
 * Inclui o endpoint de subject access request (LGPD art. 18, I-II):
 * o próprio usuário pode consultar todos os seus dados pessoais.
 */
@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async buscarMeusDados(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        nome: true,
        email: true,
        cpf: true,
        cargo: true,
        telefone: true,
        escopo: true,
        ativo: true,
        ultimoAcessoEm: true,
        criadoEm: true,
        perfil: { select: { nome: true, codigo: true } },
        municipio: { select: { nome: true, id: true } },
        regional: { select: { nome: true } },
        uf: { select: { sigla: true } },
      },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    // Submissões onde o usuário foi respondente (últimas 100)
    const submissoes = await this.prisma.submissao.findMany({
      where: { autorId: usuarioId },
      orderBy: { criadoEm: 'desc' },
      take: 100,
      select: {
        id: true,
        protocolo: true,
        status: true,
        criadoEm: true,
        nomeRespondente: true,
        cargoRespondente: true,
        emailRespondente: true,
        telefoneRespondente: true,
        // CPF mascarado — exibição integral apenas a perfis autorizados
        cpfRespondente: true,
        municipio: { select: { nome: true } },
        formularioVersao: {
          select: { versao: true, formulario: { select: { nome: true } } },
        },
      },
    });

    // Logs de auditoria associados ao usuário (últimos 50)
    const logsAuditoria = await this.prisma.logAuditoria.findMany({
      where: { atorId: usuarioId },
      orderBy: { criadoEm: 'desc' },
      take: 50,
      select: {
        id: true,
        acao: true,
        entidade: true,
        entidadeId: true,
        criadoEm: true,
        // IP e user-agent omitidos no export LGPD (minimização)
      },
    });

    return {
      exportadoEm: new Date().toISOString(),
      aviso:
        'Exportação de dados pessoais conforme LGPD art. 18. CPF mascarado conforme política de privacidade.',
      dadosCadastrais: {
        ...usuario,
        cpf: mascaraCpf(usuario.cpf),
      },
      submissoes: submissoes.map((s) => ({
        ...s,
        cpfRespondente: mascaraCpf(s.cpfRespondente),
      })),
      logsAuditoria,
    };
  }

  async listar(filtros?: { municipioId?: number; regionalId?: string; ativo?: boolean }) {
    return this.prisma.usuario.findMany({
      where: {
        ...(filtros?.municipioId !== undefined
          ? { municipioId: filtros.municipioId }
          : {}),
        ...(filtros?.regionalId ? { regionalId: filtros.regionalId } : {}),
        ...(filtros?.ativo !== undefined ? { ativo: filtros.ativo } : {}),
      },
      select: {
        id: true,
        nome: true,
        email: true,
        cpf: true,
        cargo: true,
        escopo: true,
        ativo: true,
        ultimoAcessoEm: true,
        criadoEm: true,
        perfil: { select: { nome: true, codigo: true, nivel: true } },
        municipio: { select: { nome: true, id: true } },
        regional: { select: { nome: true, id: true } },
        uf: { select: { sigla: true } },
      },
      orderBy: { nome: 'asc' },
    });
  }

  async buscarPorId(id: string, usuario: JwtPayload) {
    this.verificarEscopo(id, usuario);

    const encontrado = await this.prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        email: true,
        cpf: true,
        cargo: true,
        telefone: true,
        escopo: true,
        ativo: true,
        ultimoAcessoEm: true,
        criadoEm: true,
        perfil: { include: { permissoes: { select: { chave: true } } } },
        municipio: { select: { nome: true, id: true } },
        regional: { select: { nome: true, id: true } },
        uf: { select: { sigla: true, nome: true } },
      },
    });
    if (!encontrado) throw new NotFoundException('Usuário não encontrado.');

    return { ...encontrado, cpf: mascaraCpf(encontrado.cpf) };
  }

  async criar(dto: CriarUsuarioDto, _usuario: JwtPayload) {
    const [emailExiste, cpfExiste, perfil] = await Promise.all([
      this.prisma.usuario.findUnique({ where: { email: dto.email } }),
      this.prisma.usuario.findUnique({ where: { cpf: dto.cpf } }),
      this.prisma.perfil.findUnique({ where: { codigo: dto.perfilCodigo } }),
    ]);

    if (emailExiste) throw new BadRequestException('E-mail já cadastrado.');
    if (cpfExiste) throw new BadRequestException('CPF já cadastrado.');
    if (!perfil) throw new NotFoundException(`Perfil "${dto.perfilCodigo}" não encontrado.`);

    const senhaHash = await argon2.hash(dto.senha, { type: argon2.argon2id });

    const criado = await this.prisma.usuario.create({
      data: {
        nome: dto.nome,
        cpf: dto.cpf,
        email: dto.email,
        senhaHash,
        cargo: dto.cargo,
        telefone: dto.telefone,
        escopo: dto.escopo,
        ufId: dto.ufId ?? null,
        regionalId: dto.regionalId ?? null,
        municipioId: dto.municipioId ?? null,
        perfilId: perfil.id,
        ativo: true,
      },
      select: { id: true, nome: true, email: true, escopo: true, ativo: true },
    });

    return criado;
  }

  async atualizar(id: string, dto: AtualizarUsuarioDto, usuario: JwtPayload) {
    this.verificarEscopo(id, usuario);

    await this.buscarOuFalhar(id);

    let perfilId: string | undefined;
    if (dto.perfilCodigo) {
      const perfil = await this.prisma.perfil.findUnique({
        where: { codigo: dto.perfilCodigo },
      });
      if (!perfil) throw new NotFoundException(`Perfil "${dto.perfilCodigo}" não encontrado.`);
      perfilId = perfil.id;
    }

    return this.prisma.usuario.update({
      where: { id },
      data: {
        ...(dto.nome ? { nome: dto.nome } : {}),
        ...(dto.cargo !== undefined ? { cargo: dto.cargo } : {}),
        ...(dto.telefone !== undefined ? { telefone: dto.telefone } : {}),
        ...(perfilId ? { perfilId } : {}),
      },
      select: { id: true, nome: true, email: true, escopo: true, ativo: true },
    });
  }

  async ativar(id: string, usuario: JwtPayload) {
    this.verificarEscopo(id, usuario);
    await this.buscarOuFalhar(id);
    return this.prisma.usuario.update({
      where: { id },
      data: { ativo: true },
      select: { id: true, ativo: true },
    });
  }

  async desativar(id: string, usuario: JwtPayload) {
    this.verificarEscopo(id, usuario);
    if (id === usuario.sub) {
      throw new BadRequestException('Você não pode desativar sua própria conta.');
    }
    await this.buscarOuFalhar(id);
    return this.prisma.usuario.update({
      where: { id },
      data: { ativo: false },
      select: { id: true, ativo: true },
    });
  }

  async redefinirSenha(id: string, novaSenha: string, usuario: JwtPayload) {
    // Apenas SUPER_ADMIN (nivel 100) ou o próprio usuário
    if (id !== usuario.sub && usuario.perfilNivel < 100) {
      throw new ForbiddenException('Apenas o próprio usuário ou SUPER_ADMIN pode redefinir a senha.');
    }
    await this.buscarOuFalhar(id);
    const senhaHash = await argon2.hash(novaSenha, { type: argon2.argon2id });
    await this.prisma.usuario.update({ where: { id }, data: { senhaHash } });
    return { mensagem: 'Senha redefinida com sucesso.' };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async buscarOuFalhar(id: string) {
    const u = await this.prisma.usuario.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('Usuário não encontrado.');
    return u;
  }

  private verificarEscopo(alvoId: string, usuario: JwtPayload): void {
    // O próprio usuário sempre tem acesso aos próprios dados
    if (alvoId === usuario.sub) return;
    // Gestores estaduais e super admin têm acesso amplo
    if (usuario.perfilNivel >= 80) return;
    // Outros escopos não podem gerenciar usuários arbitrários
    throw new ForbiddenException('Acesso negado a este usuário.');
  }
}
