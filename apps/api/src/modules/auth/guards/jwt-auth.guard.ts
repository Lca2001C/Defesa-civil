import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/decorators/publico.decorator';
import type { Env } from '../../../config/env.validation';
import type { JwtPayload } from '../../../common/types/jwt-payload';

/**
 * Guard global de autenticacao JWT.
 *
 * Extrai o Bearer token do header Authorization, verifica a assinatura
 * com JWT_ACCESS_SECRET e injeta o payload em req.user.
 * Rotas marcadas com @Publico() sao liberadas sem verificacao.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly config: ConfigService<Env, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extrairToken(request);

    if (!token) {
      throw new UnauthorizedException('Token de acesso não fornecido.');
    }

    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });
      (request as Request & { user: JwtPayload }).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token de acesso inválido ou expirado.');
    }
  }

  private extrairToken(request: Request): string | null {
    const [tipo, token] = request.headers.authorization?.split(' ') ?? [];
    return tipo === 'Bearer' && token ? token : null;
  }
}
