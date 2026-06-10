import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/publico.decorator';
import { PERMISSAO_KEY } from '../decorators/permissao.decorator';
import type { JwtPayload } from '../types/jwt-payload';

/**
 * Guard global de autorizacao RBAC.
 *
 * Executa APOS o JwtAuthGuard (que autentica e popula req.user).
 * - Rotas publicas (@Publico): passam sem verificacao.
 * - Rotas sem @Permissao: protegidas por autenticacao, mas sem RBAC adicional.
 * - Rotas com @Permissao: exigem que o usuario possua TODAS as permissoes.
 */
@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const permissoesRequeridas = this.reflector.getAllAndOverride<
      string[] | undefined
    >(PERMISSAO_KEY, [context.getHandler(), context.getClass()]);

    if (!permissoesRequeridas || permissoesRequeridas.length === 0) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();

    if (!req.user) throw new ForbiddenException('Acesso negado.');

    const temTodas = permissoesRequeridas.every((p) =>
      req.user!.permissoes.includes(p),
    );

    if (!temTodas) {
      throw new ForbiddenException('Permissão insuficiente para esta operação.');
    }

    return true;
  }
}
