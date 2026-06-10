import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import type { Env } from '../../config/env.validation';
import type { JwtPayload } from '../../common/types/jwt-payload';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import type { TokensDto } from './dto/tokens.dto';

type UsuarioComPerfil = Prisma.UsuarioGetPayload<{
  include: { perfil: { include: { permissoes: true } } };
}>;

const MAX_TENTATIVAS = 5;
const BLOQUEIO_SEGUNDOS = 15 * 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

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

    // Atualiza ultimo acesso sem bloquear a resposta.
    void this.prisma.usuario.update({
      where: { id: usuario!.id },
      data: { ultimoAcessoEm: new Date() },
    });

    return this.gerarTokens(usuario!);
  }

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

  async logout(usuarioId: string): Promise<void> {
    await this.redis.getClient().del(`refresh:${usuarioId}`);
  }

  /** Retorna o hash Argon2id de uma senha em texto claro (uso no seed/admin). */
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
      this.jwt.signAsync(
        { sub: usuario.id },
        { secret: refreshSecret, expiresIn: refreshTtl },
      ),
    ]);

    // Armazena hash do refresh no Redis (revogavel no logout).
    const hashRefresh = await argon2.hash(refreshToken, { type: argon2.argon2id });
    const ttlSec = this.parseTtl(refreshTtl);
    await this.redis.getClient().setex(`refresh:${usuario.id}`, ttlSec, hashRefresh);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseTtl(accessTtl),
      tipo: 'Bearer',
    };
  }

  /** Converte "900s" | "7d" | "1h" para segundos. */
  private parseTtl(ttl: string): number {
    if (ttl.endsWith('s')) return parseInt(ttl);
    if (ttl.endsWith('m')) return parseInt(ttl) * 60;
    if (ttl.endsWith('h')) return parseInt(ttl) * 3_600;
    if (ttl.endsWith('d')) return parseInt(ttl) * 86_400;
    return parseInt(ttl);
  }
}
