import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'crypto';
import type { Env } from '../../config/env.validation';
import type { JwtPayload } from '../../common/types/jwt-payload';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import type { TokensDto } from './dto/tokens.dto';
import type { RegistrarDto } from './dto/registrar.dto';
import type { SolicitarRecuperacaoDto, RedefinirSenhaComTokenDto } from './dto/recuperar-senha.dto';

type UsuarioComPerfil = Prisma.UsuarioGetPayload<{
  include: { perfil: { include: { permissoes: true } } };
}>;

const MAX_TENTATIVAS = 5;
const BLOQUEIO_SEGUNDOS = 15 * 60;
const RECOVERY_TTL_HORAS = 1;
const PERFIL_OPERADOR = 'OPERADOR_MUNICIPAL';
const PERFIL_COORD_COMPDEC = 'COORDENADOR_COMPDEC';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ── Login ──────────────────────────────────────────────────────────────────

  async login(email: string, senha: string): Promise<TokensDto> {
    const rc = this.redis.getClient();
    const chaveAttempts = `login_fail:${email}`;

    const tentativas = await rc.get(chaveAttempts);
    if (tentativas && parseInt(tentativas) >= MAX_TENTATIVAS) {
      throw new ForbiddenException(
        'Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em 15 minutos.',
      );
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      include: { perfil: { include: { permissoes: true } } },
    });

    const senhaValida =
      !!usuario?.ativo &&
      (await argon2.verify(usuario.senhaHash, senha).catch(() => false));

    if (!senhaValida) {
      const pipeline = rc.pipeline();
      pipeline.incr(chaveAttempts);
      pipeline.expire(chaveAttempts, BLOQUEIO_SEGUNDOS);
      await pipeline.exec();
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    await rc.del(chaveAttempts);
    void this.prisma.usuario.update({
      where: { id: usuario!.id },
      data: { ultimoAcessoEm: new Date() },
    });

    return this.gerarTokens(usuario!);
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

    const rc = this.redis.getClient();
    const chaveRedis = `refresh:${payload.sub}`;
    const hashArmazenado = await rc.get(chaveRedis);

    if (!hashArmazenado) {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }

    const tokenValido = await argon2
      .verify(hashArmazenado, refreshToken)
      .catch(() => false);

    if (!tokenValido) {
      throw new UnauthorizedException('Refresh token inválido.');
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub, ativo: true },
      include: { perfil: { include: { permissoes: true } } },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuário não encontrado ou inativo.');
    }

    return this.gerarTokens(usuario);
  }

  // ── Logout ─────────────────────────────────────────────────────────────────

  async logout(usuarioId: string): Promise<void> {
    await this.redis.getClient().del(`refresh:${usuarioId}`);
  }

  // ── Registro público ───────────────────────────────────────────────────────

  async registrar(
    dto: RegistrarDto,
    ip: string,
    userAgent?: string,
  ): Promise<TokensDto> {
    if (!dto.aceiteTermoLgpd) {
      throw new BadRequestException('É obrigatório aceitar os Termos de Uso e Privacidade.');
    }
    if (dto.senha !== dto.confirmarSenha) {
      throw new BadRequestException('As senhas não conferem.');
    }

    // Unicidade
    const [emailExiste, cpfExiste] = await Promise.all([
      this.prisma.usuario.findUnique({ where: { email: dto.email } }),
      this.prisma.usuario.findUnique({ where: { cpf: dto.cpf } }),
    ]);
    if (emailExiste) throw new BadRequestException('E-mail já cadastrado.');
    if (cpfExiste) throw new BadRequestException('CPF já cadastrado.');

    // Perfil atribuído conforme autodeclaração: coordenador COMPDEC recebe perfil
    // sem permissões até o SUPER_ADMIN liberar o acesso adequado.
    const codigoPerfil = dto.ehCoordenadorCompdec ? PERFIL_COORD_COMPDEC : PERFIL_OPERADOR;
    let perfil = await this.prisma.perfil.findUnique({
      where: { codigo: codigoPerfil },
      include: { permissoes: true },
    });

    // Cria ou corrige COORDENADOR_COMPDEC garantindo as permissões básicas.
    if (!perfil && codigoPerfil === PERFIL_COORD_COMPDEC) {
      const chaves = ['painel.ver', 'submissoes.criar', 'submissoes.editar', 'relatorios.exportar'];
      const permissoesBasicas = await this.prisma.permissao.findMany({
        where: { chave: { in: chaves } },
      });
      const connect = permissoesBasicas.map((p) => ({ chave: p.chave }));
      perfil = await this.prisma.perfil.upsert({
        where: { codigo: PERFIL_COORD_COMPDEC },
        create: {
          codigo: PERFIL_COORD_COMPDEC,
          nome: 'Coordenador COMPDEC',
          nivel: 25,
          permissoes: { connect },
        },
        update: {
          nome: 'Coordenador COMPDEC',
          nivel: 25,
          permissoes: { set: connect },
        },
        include: { permissoes: true },
      });
    }

    if (!perfil) {
      throw new BadRequestException('Perfil padrão não configurado. Contate o administrador.');
    }

    // Termo LGPD
    const termo = await this.prisma.termoLgpd.findUnique({
      where: { versao: dto.versaoTermoAceito },
    });
    if (!termo) {
      throw new BadRequestException('Versão do termo de privacidade inválida.');
    }

    // Município (opcional): se informado, precisa existir (evita FK 500).
    if (dto.municipioId !== undefined && dto.municipioId !== null) {
      const municipio = await this.prisma.municipio.findUnique({
        where: { id: dto.municipioId },
      });
      if (!municipio) {
        throw new BadRequestException('Município (código IBGE) não encontrado.');
      }
    }

    const senhaHash = await argon2.hash(dto.senha, { type: argon2.argon2id });

    // Transação: cria usuário + registra aceite LGPD
    const usuario = await this.prisma.$transaction(async (tx) => {
      const novoUsuario = await tx.usuario.create({
        data: {
          nome: dto.nome,
          cpf: dto.cpf,
          email: dto.email,
          senhaHash,
          telefone: dto.telefone,
          perfilId: perfil.id,
          escopo: 'MUNICIPAL',
          ufId: 31, // MG
          municipioId: dto.municipioId ?? null,
        },
      });

      await tx.aceiteTermoLgpd.create({
        data: {
          usuarioId: novoUsuario.id,
          email: dto.email,
          ip,
          userAgent: userAgent ?? null,
          versaoTermo: dto.versaoTermoAceito,
        },
      });

      if (dto.ehCoordenadorCompdec && dto.municipioId) {
        await tx.compdec.upsert({
          where: { municipioId: dto.municipioId },
          create: {
            municipioId: dto.municipioId,
            coordenadorNome: dto.nome,
            telefone: dto.telefone,
            email: dto.email,
          },
          update: {
            coordenadorNome: dto.nome,
            telefone: dto.telefone,
            email: dto.email,
          },
        });
      }

      return novoUsuario;
    });

    // Retorna usuário com perfil para gerar tokens
    const usuarioCompleto = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuario.id },
      include: { perfil: { include: { permissoes: true } } },
    });

    return this.gerarTokens(usuarioCompleto);
  }

  // ── Termos LGPD ────────────────────────────────────────────────────────────

  async buscarTermoAtual(): Promise<{ versao: string; conteudo: string }> {
    const termo = await this.prisma.termoLgpd.findFirst({
      where: { ativo: true },
      orderBy: { criadoEm: 'desc' },
      select: { versao: true, conteudo: true },
    });
    if (!termo) throw new NotFoundException('Nenhum termo de uso ativo encontrado.');
    return termo;
  }

  // ── Recuperação de senha ───────────────────────────────────────────────────

  async solicitarRecuperacaoSenha(dto: SolicitarRecuperacaoDto): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });

    // Não revelamos se o e-mail existe (segurança)
    if (!usuario || !usuario.ativo) return;

    // Invalida tokens anteriores deste e-mail
    await this.prisma.recuperacaoSenha.updateMany({
      where: { email: dto.email, usadoEm: null },
      data: { usadoEm: new Date() },
    });

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + RECOVERY_TTL_HORAS * 3_600_000);

    await this.prisma.recuperacaoSenha.create({
      data: { email: dto.email, tokenHash, expiresAt },
    });

    // Enfileira e-mail (usa SMTP configurado; silencioso se não configurado)
    const baseUrl =
      (this.config.get('PUBLIC_BASE_URL' as keyof Env, { infer: true }) as string | undefined) ??
      'http://localhost:3000';
    const link = `${baseUrl}/redefinir-senha?token=${token}`;

    const smtpHost = this.config.get('SMTP_HOST' as keyof Env, { infer: true }) as string | undefined;
    if (smtpHost) {
      // Importação dinâmica para evitar erro se nodemailer não estiver instalado
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodemailer = require('nodemailer') as typeof import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(this.config.get('SMTP_PORT' as keyof Env, { infer: true }) ?? 587),
        secure: false,
        auth: {
          user: this.config.get('SMTP_USER' as keyof Env, { infer: true }) as string,
          pass: this.config.get('SMTP_PASS' as keyof Env, { infer: true }) as string,
        },
      });
      const from =
        (this.config.get('SMTP_FROM' as keyof Env, { infer: true }) as string | undefined) ??
        '"Defesa Civil MG" <noreply@defesacivil.mg.gov.br>';
      await transporter.sendMail({
        from,
        to: dto.email,
        subject: 'Redefinição de senha — Defesa Civil MG',
        html: `<p>Olá, <strong>${usuario.nome}</strong>.</p>
               <p>Clique no link abaixo para redefinir sua senha. O link expira em ${RECOVERY_TTL_HORAS} hora(s).</p>
               <p><a href="${link}">${link}</a></p>
               <p>Se você não solicitou a redefinição, ignore este e-mail.</p>`,
      });
    }
  }

  async redefinirSenhaComToken(dto: RedefinirSenhaComTokenDto): Promise<void> {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');

    const recuperacao = await this.prisma.recuperacaoSenha.findUnique({
      where: { tokenHash },
    });

    if (!recuperacao) {
      throw new BadRequestException('Link de redefinição inválido.');
    }
    if (recuperacao.usadoEm) {
      throw new BadRequestException('Este link já foi utilizado.');
    }
    if (recuperacao.expiresAt < new Date()) {
      throw new BadRequestException('Link de redefinição expirado. Solicite um novo.');
    }

    const senhaHash = await argon2.hash(dto.novaSenha, { type: argon2.argon2id });

    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { email: recuperacao.email },
        data: { senhaHash },
      }),
      this.prisma.recuperacaoSenha.update({
        where: { tokenHash },
        data: { usadoEm: new Date() },
      }),
    ]);

    // Invalida todas as sessões ativas (logout global)
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: recuperacao.email },
      select: { id: true },
    });
    if (usuario) {
      await this.redis.getClient().del(`refresh:${usuario.id}`);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  async hashSenha(senha: string): Promise<string> {
    return argon2.hash(senha, { type: argon2.argon2id });
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

    const hashRefresh = await argon2.hash(refreshToken, { type: argon2.argon2id });
    const ttlSec = this.parseTtl(refreshTtl);
    await this.redis.getClient().setex(`refresh:${usuario.id}`, ttlSec, hashRefresh);

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
