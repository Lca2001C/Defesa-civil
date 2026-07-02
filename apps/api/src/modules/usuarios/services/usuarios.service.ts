import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { mascaraCpf } from '../../../shared/utils/format.util';
import { hashSenha } from '../../../shared/hash.util';
import { PERMISSION_LEVEL } from '../../../shared/constants';
import type { JwtPayload } from '../../../common/types/jwt-payload';
import { UsuariosRepository } from '../repositories/usuarios.repository';
import type { CriarUsuarioDto } from '../dtos/criar-usuario.dto';
import type { AtualizarUsuarioDto } from '../dtos/atualizar-usuario.dto';

/**
 * Serviço de usuários.
 *
 * Regras de acesso ao MÓDULO de gestão de usuários (backend = fonte da verdade,
 * não confie só no frontend):
 *  - Gerenciar usuários (listar/criar/editar/ativar/desativar): nível >=
 *    GESTOR_ESTADUAL (80). Ou seja, apenas Gestor Estadual e Super Admin.
 *  - Mudar o nível de permissão (perfil) de um usuário OU excluir usuários:
 *    apenas SUPER_ADMIN (100).
 *
 * Inclui também o subject access request (LGPD art. 18, I-II): o próprio
 * usuário pode consultar todos os seus dados pessoais (endpoints /me e
 * /meus-dados, que NÃO exigem gestão de usuários).
 */
@Injectable()
export class UsuariosService {
  constructor(private readonly repo: UsuariosRepository) {}

  async buscarMeusDados(usuarioId: string) {
    const usuario = await this.repo.buscarCadastroLgpd(usuarioId);
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    const [submissoes, logsAuditoria] = await Promise.all([
      this.repo.listarSubmissoesLgpd(usuarioId),
      this.repo.listarLogsLgpd(usuarioId),
    ]);

    return {
      exportadoEm: new Date().toISOString(),
      aviso:
        'Exportação de dados pessoais conforme LGPD art. 18. CPF mascarado conforme política de privacidade.',
      dadosCadastrais: { ...usuario, cpf: mascaraCpf(usuario.cpf) },
      submissoes: submissoes.map((s) => ({ ...s, cpfRespondente: mascaraCpf(s.cpfRespondente) })),
      logsAuditoria,
    };
  }

  async buscarMe(usuarioId: string) {
    const usuario = await this.repo.buscarMe(usuarioId);
    if (!usuario) throw new NotFoundException('Usuário não encontrado');
    return { ...usuario, cpf: mascaraCpf(usuario.cpf) };
  }

  atualizarMe(usuarioId: string, dto: { nome?: string; cargo?: string; telefone?: string }) {
    const data: { nome?: string; cargo?: string; telefone?: string } = {};
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.cargo !== undefined) data.cargo = dto.cargo;
    if (dto.telefone !== undefined) data.telefone = dto.telefone;
    return this.repo.atualizarPerfilProprio(usuarioId, data);
  }

  async listar(
    filtros: { municipioId?: number; regionalId?: string; ativo?: boolean },
    usuario: JwtPayload,
  ) {
    this.exigirGestaoUsuarios(usuario);
    // Escopo do solicitante (LGPD/minimização): só gestores estaduais veem todos.
    const usuarios = await this.repo.listar(filtros ?? {}, this.escopoListagem(usuario));
    // Máscara de CPF na grade (mesma política dos demais endpoints).
    return usuarios.map((u) => ({ ...u, cpf: mascaraCpf(u.cpf) }));
  }

  /** Restringe a listagem de usuários ao escopo do solicitante. */
  private escopoListagem(usuario: JwtPayload): Prisma.UsuarioWhereInput {
    if (usuario.perfilNivel >= PERMISSION_LEVEL.GESTOR_ESTADUAL) return {};
    if (usuario.escopo === 'MUNICIPAL' && usuario.municipioId) {
      return { municipioId: usuario.municipioId };
    }
    if (usuario.escopo === 'REGIONAL' && usuario.regionalId) {
      return {
        OR: [
          { regionalId: usuario.regionalId },
          { municipio: { regionalId: usuario.regionalId } },
        ],
      };
    }
    // Sem escopo reconhecível e sem nível estadual: só o próprio registro.
    return { id: usuario.sub };
  }

  async buscarPorId(id: string, usuario: JwtPayload) {
    this.exigirGestaoUsuarios(usuario);
    this.verificarEscopo(id, usuario);
    const encontrado = await this.repo.buscarDetalhado(id);
    if (!encontrado) throw new NotFoundException('Usuário não encontrado.');
    return { ...encontrado, cpf: mascaraCpf(encontrado.cpf) };
  }

  async criar(dto: CriarUsuarioDto, usuario: JwtPayload) {
    this.exigirGestaoUsuarios(usuario);
    const [emailExiste, cpfExiste, perfilAlvo] = await Promise.all([
      this.repo.emailExiste(dto.email),
      this.repo.cpfExiste(dto.cpf),
      this.repo.buscarPerfilPorCodigo(dto.perfilCodigo),
    ]);

    if (emailExiste) throw new BadRequestException('E-mail já cadastrado.');
    if (cpfExiste) throw new BadRequestException('CPF já cadastrado.');
    if (!perfilAlvo) throw new NotFoundException(`Perfil "${dto.perfilCodigo}" não encontrado.`);

    // Anti-escalonamento: ninguém cria/atribui perfil de nível ACIMA do seu.
    this.validarNivelAlvo(perfilAlvo.nivel, usuario);
    // Multi-tenant: o ator não pode criar usuário fora do seu escopo.
    await this.validarEscopoAlvo(dto, usuario);

    const senhaHash = await hashSenha(dto.senha);

    return this.repo.criar({
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
      perfilId: perfilAlvo.id,
    });
  }

  async atualizar(id: string, dto: AtualizarUsuarioDto, usuario: JwtPayload) {
    this.exigirGestaoUsuarios(usuario);
    this.verificarEscopo(id, usuario);
    await this.buscarOuFalhar(id);

    let perfilId: string | undefined;
    if (dto.perfilCodigo) {
      // Mudar o nível de permissão (perfil) é exclusivo do SUPER_ADMIN.
      this.exigirSuperAdmin(usuario, 'alterar o perfil (nível de permissão) de um usuário');
      const perfilAlvo = await this.repo.buscarPerfilPorCodigo(dto.perfilCodigo);
      if (!perfilAlvo) throw new NotFoundException(`Perfil "${dto.perfilCodigo}" não encontrado.`);
      // Anti-escalonamento: não promover a um nível acima do próprio.
      this.validarNivelAlvo(perfilAlvo.nivel, usuario);
      perfilId = perfilAlvo.id;
    }

    return this.repo.atualizar(id, {
      ...(dto.nome ? { nome: dto.nome } : {}),
      ...(dto.cargo !== undefined ? { cargo: dto.cargo } : {}),
      ...(dto.telefone !== undefined ? { telefone: dto.telefone } : {}),
      ...(perfilId ? { perfilId } : {}),
    });
  }

  async ativar(id: string, usuario: JwtPayload) {
    this.exigirGestaoUsuarios(usuario);
    this.verificarEscopo(id, usuario);
    await this.buscarOuFalhar(id);
    return this.repo.definirAtivo(id, true);
  }

  async desativar(id: string, usuario: JwtPayload) {
    this.exigirGestaoUsuarios(usuario);
    this.verificarEscopo(id, usuario);
    if (id === usuario.sub) {
      throw new BadRequestException('Você não pode desativar sua própria conta.');
    }
    await this.buscarOuFalhar(id);
    return this.repo.definirAtivo(id, false);
  }

  async redefinirSenha(id: string, novaSenha: string, usuario: JwtPayload) {
    // Apenas SUPER_ADMIN ou o próprio usuário
    if (id !== usuario.sub && usuario.perfilNivel < PERMISSION_LEVEL.SUPER_ADMIN) {
      throw new ForbiddenException('Apenas o próprio usuário ou SUPER_ADMIN pode redefinir a senha.');
    }
    await this.buscarOuFalhar(id);
    const senhaHash = await hashSenha(novaSenha);
    await this.repo.atualizarSenha(id, senhaHash);

    // Segurança: invalida as sessões ativas do usuário (logout global) após a
    // troca de senha — paridade com o fluxo de redefinição por token.
    await this.repo.invalidarSessoes(id);

    return { mensagem: 'Senha redefinida com sucesso.' };
  }

  async excluir(id: string, usuario: JwtPayload) {
    // Excluir usuários é exclusivo do SUPER_ADMIN.
    this.exigirSuperAdmin(usuario, 'excluir usuários');

    if (id === usuario.sub) {
      throw new BadRequestException('Você não pode excluir sua própria conta.');
    }

    const alvo = await this.buscarOuFalhar(id);

    if (await this.repo.perfilEhSuperAdmin(alvo.perfilId)) {
      const totalSuperAdmin = await this.repo.contarSuperAdminsAtivos();
      if (totalSuperAdmin <= 1) {
        throw new BadRequestException('Não é possível excluir o único SUPER_ADMIN ativo do sistema.');
      }
    }

    const totalSubmissoes = await this.repo.contarSubmissoesDoAutor(id);
    if (totalSubmissoes > 0) {
      throw new BadRequestException(
        `Usuário possui ${totalSubmissoes} submissão(ões) vinculada(s). Exclua as submissões antes de remover o usuário.`,
      );
    }

    await this.repo.remover(id);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async buscarOuFalhar(id: string) {
    const u = await this.repo.buscarPorId(id);
    if (!u) throw new NotFoundException('Usuário não encontrado.');
    return u;
  }

  /**
   * Restringe o MÓDULO de gestão de usuários a Gestor Estadual (80) e Super
   * Admin (100). Independe da permissão "usuarios.gerenciar" — é a barreira que
   * impede perfis municipais/regionais de acessarem o módulo, mesmo via API.
   */
  private exigirGestaoUsuarios(usuario: JwtPayload): void {
    if (usuario.perfilNivel < PERMISSION_LEVEL.GESTOR_ESTADUAL) {
      throw new ForbiddenException(
        'Módulo de usuários restrito a Gestor Estadual e Super Administrador.',
      );
    }
  }

  /** Ações exclusivas do Super Administrador (mudar nível de permissão / excluir). */
  private exigirSuperAdmin(usuario: JwtPayload, acao: string): void {
    if (usuario.perfilNivel < PERMISSION_LEVEL.SUPER_ADMIN) {
      throw new ForbiddenException(`Apenas o Super Administrador pode ${acao}.`);
    }
  }

  private verificarEscopo(alvoId: string, usuario: JwtPayload): void {
    // O próprio usuário sempre tem acesso aos próprios dados
    if (alvoId === usuario.sub) return;
    // Gestores estaduais e super admin têm acesso amplo
    if (usuario.perfilNivel >= PERMISSION_LEVEL.GESTOR_ESTADUAL) return;
    // Outros escopos não podem gerenciar usuários arbitrários
    throw new ForbiddenException('Acesso negado a este usuário.');
  }

  /** Impede conceder/atribuir um perfil de nível ACIMA do nível do solicitante. */
  private validarNivelAlvo(nivelAlvo: number, usuario: JwtPayload): void {
    if (nivelAlvo > usuario.perfilNivel) {
      throw new ForbiddenException(
        'Você não pode atribuir um perfil de nível superior ao seu.',
      );
    }
  }

  /** Garante que o usuário criado pertence ao escopo (tenant) do solicitante. */
  private async validarEscopoAlvo(dto: CriarUsuarioDto, usuario: JwtPayload): Promise<void> {
    // Gestores estaduais podem criar em qualquer escopo.
    if (usuario.perfilNivel >= PERMISSION_LEVEL.GESTOR_ESTADUAL) return;

    if (usuario.escopo === 'MUNICIPAL') {
      if (dto.escopo !== 'MUNICIPAL' || dto.municipioId !== usuario.municipioId) {
        throw new ForbiddenException('Você só pode criar usuários do seu próprio município.');
      }
      return;
    }

    if (usuario.escopo === 'REGIONAL') {
      if (dto.escopo === 'ESTADUAL') {
        throw new ForbiddenException('Você não pode criar usuários de escopo estadual.');
      }
      if (dto.escopo === 'REGIONAL' && dto.regionalId !== usuario.regionalId) {
        throw new ForbiddenException('Você só pode criar usuários da sua regional.');
      }
      if (dto.escopo === 'MUNICIPAL') {
        const regional = dto.municipioId
          ? await this.repo.buscarRegionalDoMunicipio(dto.municipioId)
          : null;
        if (!regional || regional !== usuario.regionalId) {
          throw new ForbiddenException('Você só pode criar usuários de municípios da sua regional.');
        }
      }
      return;
    }

    // Escopo não reconhecido sem nível estadual: bloqueia por segurança.
    throw new ForbiddenException('Escopo insuficiente para criar usuários.');
  }
}
