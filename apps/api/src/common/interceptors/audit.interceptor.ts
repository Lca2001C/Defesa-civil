import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { JwtPayload } from '../types/jwt-payload';

const METODOS_AUDITADOS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Interceptor global de auditoria (LGPD — responsabilizacao).
 *
 * Registra um LogAuditoria para toda requisicao mutante (POST/PUT/PATCH/DELETE).
 * Operacao fire-and-forget: nao bloqueia nem atrasa a resposta.
 * Erros de auditoria sao silenciados para nao impactar a API.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();

    if (!METODOS_AUDITADOS.has(req.method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: () => void this.registrar(req),
        error: () => void this.registrar(req),
      }),
    );
  }

  private async registrar(
    req: Request & { user?: JwtPayload },
  ): Promise<void> {
    try {
      const prefixo = process.env['API_PREFIX'] ?? 'api';
      const semPrefixo = req.path.replace(new RegExp(`^/${prefixo}/`), '');
      const partes = semPrefixo.split('/').filter(Boolean);
      const entidade = partes[0] ?? 'desconhecido';
      const entidadeId = partes[1] ?? null;

      const ipBruto =
        (req.headers['x-forwarded-for'] as string | undefined)
          ?.split(',')[0]
          ?.trim() ?? req.ip;

      await this.prisma.logAuditoria.create({
        data: {
          atorId: req.user?.sub ?? null,
          acao: `${req.method} ${req.path}`,
          entidade,
          entidadeId,
          ip: ipBruto ?? null,
          userAgent:
            (req.headers['user-agent'] as string | undefined) ?? null,
        },
      });
    } catch {
      // Erros de auditoria nunca quebram a requisicao principal.
    }
  }
}
