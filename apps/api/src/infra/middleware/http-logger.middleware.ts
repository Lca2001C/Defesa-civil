import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import type { JwtPayload } from '../../common/types/jwt-payload';

const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Middleware que:
 *  1. Gera (ou lê) um correlation ID em X-Request-ID e propaga na resposta.
 *  2. Loga cada requisição com método, path, status, duração, IP e userId.
 *
 * Formato: JSON estruturado para fácil ingestão por Loki/CloudWatch.
 */
@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(
    req: Request & { user?: JwtPayload; requestId?: string },
    res: Response,
    next: NextFunction,
  ): void {
    const requestId =
      (req.headers[REQUEST_ID_HEADER] as string | undefined) ?? randomUUID();

    req.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    const inicio = Date.now();
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.ip;

    res.on('finish', () => {
      const duracao = Date.now() - inicio;
      const nivel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'log';

      this.logger[nivel](
        JSON.stringify({
          requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: duracao,
          ip,
          userId: req.user?.sub ?? null,
          userAgent: req.headers['user-agent'] ?? null,
        }),
      );
    });

    next();
  }
}
