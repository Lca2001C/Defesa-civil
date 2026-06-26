import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'crypto';
import type { Env } from '../../../config/env.validation';
import type { JwtPayload } from '../../../common/types/jwt-payload';
import { CacheService } from '../../../infra/cache/cache.service';
import { hashSenha, verificarSenha } from '../../../shared/hash.util';
import { escapeHtml } from '../../../shared/utils/format.util';
import { AuditoriaService } from '../../auditoria/services/auditoria.service';
import { AuthRepository, type UsuarioComPerfil } from '../repositories/auth.repository';
import type { TokensDto } from '../dtos/tokens.dto';
import type { RegistrarDto } from '../dtos/registrar.dto';
import type { SolicitarRecuperacaoDto, RedefinirSenhaComTokenDto } from '../dtos/recuperar-senha.dto';

const MAX_TENTATIVAS = 5;
// Limite por IP (mais alto): mitiga brute-force distribuído e ataque de um IP
// contra várias contas, sem que o lockout por e-mail (DoS de conta) seja o único
// controle. Janela igual ao bloqueio por e-mail.
const MAX_TENTATIVAS_IP = 30;
const BLOQUEIO_SEGUNDOS = 15 * 60;
const RECOVERY_TTL_HORAS = 1;
// Rate limit dedicado da recuperação de senha (anti-enumeração / e-mail bombing).
const RESET_MAX = 3;
const RESET_JANELA_SEGUNDOS = 15 * 60;

/** Contexto de origem da requisição (para auditoria). */
export interface OrigemRequisicao {
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly cache: CacheService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly auditoria: AuditoriaService,
  ) {}

  // ── Login ──────────────────────────────────────────────────────────────────

  async login(email: string, senha: string, origem: OrigemRequisicao = {}): Promise<TokensDto> {
    const chaveAttempts = `login_fail:${email}`;
    const chaveIp = origem.ip ? `login_fail_ip:${origem.ip}` : null;

    const [tentativas, tentativasIp] = await Promise.all([
      this.cache.getNumero(chaveAttempts),
      chaveIp ? this.cache.getNumero(chaveIp) : Promise.resolve(0),
    ]);
    if (tentativas >= MAX_TENTATIVAS) {
      throw new ForbiddenException(
        'Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em 15 minutos.',
      );
    }
    if (chaveIp && tentativasIp >= MAX_TENTATIVAS_IP) {
      throw new ForbiddenException(
        'Muitas tentativas de login a partir deste endereço. Tente novamente em 15 minutos.',
      );
    }

    const usuario = await this.repo.buscarPorEmailComPerfil(email);
    // Sempre executa um verify Argon2 (contra um hash dummy quando o usuário não
    // existe) para equalizar o tempo de resposta e evitar enumeração por timing.
    const hashParaVerificar = usuario?.senhaHash ?? (await this.obterDummyHash());
    const senhaConfere = await verificarSenha(hashParaVerificar, senha);
    const senhaValida = !!usuario?.ativo && senhaConfere;

    if (!senhaValida || !usuario) {
      await this.cache.incr(chaveAttempts, BLOQUEIO_SEGUNDOS);
      if (chaveIp) await this.cache.incr(chaveIp, BLOQUEIO_SEGUNDOS);
      void this.auditoria.registrar({
        atorId: usuario?.id ?? null,
        acao: 'LOGIN_FALHA',
        entidade: 'auth',
        entidadeId: email,
        ip: origem.ip,
        userAgent: origem.userAgent,
      });
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    await this.cache.del(chaveAttempts);
    this.repo.marcarUltimoAcesso(usuario.id);

    void this.auditoria.registrar({
      atorId: usuario.id,
      acao: 'LOGIN_SUCESSO',
      entidade: 'auth',
      entidadeId: usuario.id,
      ip: origem.ip,
      userAgent: origem.userAgent,
    });

    return this.gerarTokens(usuario);
  }

  // ── Refresh ────────────────────────────────────────────────────────────────

  async refresh(refreshToken: string): Promise<TokensDto> {
    let payload: Pick<JwtPayload, 'sub'>;
    try {
      payload = this.jwt.verify<Pick<JwtPayload, 'sub'>>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }

    const hashArmazenado = await this.repo.buscarRefresh(payload.sub);
    if (!hashArmazenado) {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }

    const tokenValido = await verificarSenha(hashArmazenado, refreshToken);
    if (!tokenValido) {
      throw new UnauthorizedException('Refresh token inválido.');
    }

    const usuario = await this.repo.buscarAtivoPorIdComPerfil(payload.sub);
    if (!usuario) {
      throw new UnauthorizedException('Usuário não encontrado ou inativo.');
    }

    return this.gerarTokens(usuario);
  }

  // ── Logout ─────────────────────────────────────────────────────────────────

  async logout(usuarioId: string, origem: OrigemRequisicao = {}): Promise<void> {
    await this.repo.deletarRefresh(usuarioId);
    void this.auditoria.registrar({
      atorId: usuarioId,
      acao: 'LOGOUT',
      entidade: 'auth',
      entidadeId: usuarioId,
      ip: origem.ip,
      userAgent: origem.userAgent,
    });
  }

  // ── Registro público ───────────────────────────────────────────────────────

  async registrar(dto: RegistrarDto, ip: string, userAgent?: string): Promise<TokensDto> {
    if (!dto.aceiteTermoLgpd) {
      throw new BadRequestException('É obrigatório aceitar os Termos de Uso e Privacidade.');
    }
    if (dto.senha !== dto.confirmarSenha) {
      throw new BadRequestException('As senhas não conferem.');
    }

    const [emailExiste, cpfExiste] = await Promise.all([
      this.repo.emailExiste(dto.email),
      this.repo.cpfExiste(dto.cpf),
    ]);
    if (emailExiste) throw new BadRequestException('E-mail já cadastrado.');
    if (cpfExiste) throw new BadRequestException('CPF já cadastrado.');

    const perfil = await this.repo.resolverPerfilRegistro(dto.ehCoordenadorCompdec);
    if (!perfil) {
      throw new BadRequestException('Perfil padrão não configurado. Contate o administrador.');
    }

    if (!(await this.repo.termoExiste(dto.versaoTermoAceito))) {
      throw new BadRequestException('Versão do termo de privacidade inválida.');
    }

    if (dto.municipioId !== undefined && dto.municipioId !== null) {
      if (!(await this.repo.municipioExiste(dto.municipioId))) {
        throw new BadRequestException('Município (código IBGE) não encontrado.');
      }
    }

    const senhaHash = await hashSenha(dto.senha);

    const usuarioCompleto = await this.repo.criarUsuarioComAceite({
      nome: dto.nome,
      cpf: dto.cpf,
      email: dto.email,
      senhaHash,
      telefone: dto.telefone,
      perfilId: perfil.id,
      municipioId: dto.municipioId ?? null,
      ehCoordenadorCompdec: dto.ehCoordenadorCompdec,
      versaoTermoAceito: dto.versaoTermoAceito,
      ip,
      userAgent,
    });

    return this.gerarTokens(usuarioCompleto);
  }

  // ── Termos LGPD ────────────────────────────────────────────────────────────

  async buscarTermoAtual(): Promise<{ versao: string; conteudo: string }> {
    const termo = await this.repo.buscarTermoAtivo();
    if (!termo) throw new NotFoundException('Nenhum termo de uso ativo encontrado.');
    return termo;
  }

  // ── Recuperação de senha ───────────────────────────────────────────────────

  async solicitarRecuperacaoSenha(
    dto: SolicitarRecuperacaoDto,
    origem: OrigemRequisicao = {},
  ): Promise<void> {
    // Rate limit dedicado por e-mail e por IP (anti-enumeração / e-mail bombing).
    // Aplicado ANTES de qualquer consulta e sem revelar se o e-mail existe.
    if (await this.resetExcedido(`pwreset:${dto.email}`)) return;
    if (origem.ip && (await this.resetExcedido(`pwreset_ip:${origem.ip}`))) return;

    const usuario = await this.repo.buscarParaRecuperacao(dto.email);

    // Não revelamos se o e-mail existe (segurança).
    if (!usuario || !usuario.ativo) return;

    await this.repo.invalidarRecuperacoesAnteriores(dto.email);

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + RECOVERY_TTL_HORAS * 3_600_000);

    await this.repo.criarRecuperacao(dto.email, tokenHash, expiresAt);
    await this.enviarEmailRecuperacao(dto.email, usuario.nome, token);
  }

  /** Incrementa o contador de reset e indica se o limite da janela foi excedido. */
  private async resetExcedido(chave: string): Promise<boolean> {
    const n = await this.cache.incr(chave, RESET_JANELA_SEGUNDOS);
    return n > RESET_MAX;
  }

  private async enviarEmailRecuperacao(email: string, nome: string, token: string): Promise<void> {
    const baseUrl = this.config.get('PUBLIC_BASE_URL', { infer: true }) || 'http://localhost:3000';
    const link = `${baseUrl}/redefinir-senha?token=${encodeURIComponent(token)}`;

    const smtpHost = this.config.get('SMTP_HOST', { infer: true });
    if (!smtpHost) return;

    // Importação dinâmica para evitar erro se nodemailer não estiver instalado
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodemailer = require('nodemailer') as typeof import('nodemailer');
    const port = this.config.get('SMTP_PORT', { infer: true });
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: {
        user: this.config.get('SMTP_USER', { infer: true }),
        pass: this.config.get('SMTP_PASS', { infer: true }),
      },
    });
    const from = this.config.get('SMTP_FROM', { infer: true });
    await transporter.sendMail({
      from,
      to: email,
      subject: 'Redefinição de senha — Defesa Civil MG',
      html: `<p>Olá, <strong>${escapeHtml(nome)}</strong>.</p>
             <p>Clique no link abaixo para redefinir sua senha. O link expira em ${RECOVERY_TTL_HORAS} hora(s).</p>
             <p><a href="${link}">${link}</a></p>
             <p>Se você não solicitou a redefinição, ignore este e-mail.</p>`,
    });
  }

  async redefinirSenhaComToken(
    dto: RedefinirSenhaComTokenDto,
    origem: OrigemRequisicao = {},
  ): Promise<void> {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');

    const recuperacao = await this.repo.buscarRecuperacao(tokenHash);
    if (!recuperacao) throw new BadRequestException('Link de redefinição inválido.');
    if (recuperacao.usadoEm) throw new BadRequestException('Este link já foi utilizado.');
    if (recuperacao.expiresAt < new Date()) {
      throw new BadRequestException('Link de redefinição expirado. Solicite um novo.');
    }

    const senhaHash = await hashSenha(dto.novaSenha);
    await this.repo.redefinirSenhaPorToken(recuperacao.email, senhaHash, tokenHash);

    // Invalida todas as sessões ativas (logout global).
    const usuarioId = await this.repo.buscarIdPorEmail(recuperacao.email);
    if (usuarioId) await this.repo.deletarRefresh(usuarioId);

    void this.auditoria.registrar({
      atorId: usuarioId,
      acao: 'SENHA_REDEFINIDA',
      entidade: 'auth',
      entidadeId: usuarioId ?? recuperacao.email,
      ip: origem.ip,
      userAgent: origem.userAgent,
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  hashSenha(senha: string): Promise<string> {
    return hashSenha(senha);
  }

  /** Hash Argon2 dummy (calculado uma vez) para equalizar o tempo do login. */
  private dummyHashCache: string | null = null;
  private async obterDummyHash(): Promise<string> {
    if (!this.dummyHashCache) {
      this.dummyHashCache = await hashSenha('dummy-password-para-timing-uniforme');
    }
    return this.dummyHashCache;
  }

  private async gerarTokens(usuario: UsuarioComPerfil): Promise<TokensDto> {
    const permissoes = usuario.perfil.permissoes.map((p) => p.chave);

    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      perfilCodigo: usuario.perfil.codigo,
      perfilNivel: usuario.perfil.nivel,
      escopo: usuario.escopo,
      ufId: usuario.ufId,
      regionalId: usuario.regionalId,
      municipioId: usuario.municipioId,
      permissoes,
    };

    const accessSecret = this.config.get('JWT_ACCESS_SECRET', { infer: true });
    const refreshSecret = this.config.get('JWT_REFRESH_SECRET', { infer: true });
    const accessTtl = this.config.get('JWT_ACCESS_TTL', { infer: true });
    const refreshTtl = this.config.get('JWT_REFRESH_TTL', { infer: true });

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, { secret: accessSecret, expiresIn: accessTtl }),
      this.jwt.signAsync({ sub: usuario.id }, { secret: refreshSecret, expiresIn: refreshTtl }),
    ]);

    const hashRefresh = await hashSenha(refreshToken);
    const expiraEm = new Date(Date.now() + this.parseTtl(refreshTtl) * 1000);
    await this.repo.salvarRefresh(usuario.id, hashRefresh, expiraEm);

    return { accessToken, refreshToken, expiresIn: this.parseTtl(accessTtl), tipo: 'Bearer' };
  }

  private parseTtl(ttl: string): number {
    if (ttl.endsWith('s')) return parseInt(ttl);
    if (ttl.endsWith('m')) return parseInt(ttl) * 60;
    if (ttl.endsWith('h')) return parseInt(ttl) * 3_600;
    if (ttl.endsWith('d')) return parseInt(ttl) * 86_400;
    return parseInt(ttl);
  }
}
