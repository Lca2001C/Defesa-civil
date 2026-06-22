import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mascaraCpf } from '../../../shared/utils/format.util';
import { hashSenha } from '../../../shared/hash.util';
import { PERMISSION_LEVEL } from '../../../shared/constants';
import type { JwtPayload } from '../../../common/types/jwt-payload';
import { RedisService } from '../../../infra/redis/redis.service';
import { UsuariosRepository } from '../repositories/usuarios.repository';
import type { CriarUsuarioDto } from '../dto/criar-usuario.dto';
import type { AtualizarUsuarioDto } from '../dto/atualizar-usuario.dto';

/**
 * Serviço de usuários.
 *
 * Inclui o endpoint de subject access request (LGPD art. 18, I-II):
 * o próprio usuário pode consultar todos os seus dados pessoais.
 */
@Injectable()
export class UsuariosService {
  constructor(
    private readonly repo: UsuariosRepository,
    private readonly redis: RedisService,
  ) {}

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

  listar(filtros?: { municipioId?: number; regionalId?: string; ativo?: boolean }) {
    return this.repo.listar(filtros ?? {});
  }

  async buscarPorId(id: string, usuario: JwtPayload) {
    this.verificarEscopo(id, usuario);
    const encontrado = await this.repo.buscarDetalhado(id);
    if (!encontrado) throw new NotFoundException('Usuário não encontrado.');
    return { ...encontrado, cpf: mascaraCpf(encontrado.cpf) };
  }

  async criar(dto: CriarUsuarioDto, _usuario: JwtPayload) {
    const [emailExiste, cpfExiste, perfilId] = await Promise.all([
      this.repo.emailExiste(dto.email),
      this.repo.cpfExiste(dto.cpf),
      this.repo.buscarPerfilIdPorCodigo(dto.perfilCodigo),
    ]);

    if (emailExiste) throw new BadRequestException('E-mail já cadastrado.');
    if (cpfExiste) throw new BadRequestException('CPF já cadastrado.');
    if (!perfilId) throw new NotFoundException(`Perfil "${dto.perfilCodigo}" não encontrado.`);

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
      perfilId,
    });
  }

  async atualizar(id: string, dto: AtualizarUsuarioDto, usuario: JwtPayload) {
    this.verificarEscopo(id, usuario);
    await this.buscarOuFalhar(id);

    let perfilId: string | undefined;
    if (dto.perfilCodigo) {
      const resolvido = await this.repo.buscarPerfilIdPorCodigo(dto.perfilCodigo);
      if (!resolvido) throw new NotFoundException(`Perfil "${dto.perfilCodigo}" não encontrado.`);
      perfilId = resolvido;
    }

    return this.repo.atualizar(id, {
      ...(dto.nome ? { nome: dto.nome } : {}),
      ...(dto.cargo !== undefined ? { cargo: dto.cargo } : {}),
      ...(dto.telefone !== undefined ? { telefone: dto.telefone } : {}),
      ...(perfilId ? { perfilId } : {}),
    });
  }

  async ativar(id: string, usuario: JwtPayload) {
    this.verificarEscopo(id, usuario);
    await this.buscarOuFalhar(id);
    return this.repo.definirAtivo(id, true);
  }

  async desativar(id: string, usuario: JwtPayload) {
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
    await this.redis.getClient().del(`refresh:${id}`);

    return { mensagem: 'Senha redefinida com sucesso.' };
  }

  async excluir(id: string, usuario: JwtPayload) {
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

  private verificarEscopo(alvoId: string, usuario: JwtPayload): void {
    // O próprio usuário sempre tem acesso aos próprios dados
    if (alvoId === usuario.sub) return;
    // Gestores estaduais e super admin têm acesso amplo
    if (usuario.perfilNivel >= PERMISSION_LEVEL.GESTOR_ESTADUAL) return;
    // Outros escopos não podem gerenciar usuários arbitrários
    throw new ForbiddenException('Acesso negado a este usuário.');
  }
}
