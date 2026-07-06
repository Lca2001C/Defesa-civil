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
import { NIVEL_MINIMO_KEY } from '../decorators/nivel-minimo.decorator';
import type { JwtPayload } from '../types/jwt-payload';

/**
 * Guard global de autorizacao RBAC.
 *
 * Executa APOS o JwtAuthGuard (que autentica e popula req.user).
 * - Rotas publicas (@Publico): passam sem verificacao.
 * - Rotas sem @Permissao/@NivelMinimo: protegidas por autenticacao, sem RBAC extra.
 * - Rotas com @NivelMinimo: exigem `perfilNivel >= nivel` (barreira por nivel).
 * - Rotas com @Permissao: exigem que o usuario possua TODAS as permissoes.
 *
 * Quando ambos estao presentes, os dois sao verificados (nivel E permissoes).
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

    const nivelMinimo = this.reflector.getAllAndOverride<number | undefined>(
      NIVEL_MINIMO_KEY,
      [context.getHandler(), context.getClass()],
    );

    const exigePermissoes = !!permissoesRequeridas && permissoesRequeridas.length > 0;
    const exigeNivel = typeof nivelMinimo === 'number';

    // Rota sem exigencia de RBAC: basta estar autenticada.
    if (!exigePermissoes && !exigeNivel) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();

    if (!req.user) throw new ForbiddenException('Acesso negado.');

    // Barreira por NIVEL: independe das permissoes granulares.
    if (exigeNivel && req.user.perfilNivel < nivelMinimo!) {
      throw new ForbiddenException('Nível de acesso insuficiente para esta operação.');
    }

    if (exigePermissoes) {
      const temTodas = permissoesRequeridas!.every((p) =>
        req.user!.permissoes.includes(p),
      );
      if (!temTodas) {
        throw new ForbiddenException('Permissão insuficiente para esta operação.');
      }
    }

    return true;
  }
}
