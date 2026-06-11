import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { Env } from '../../config/env.validation';
import { RedisService } from '../../infra/redis/redis.service';

/**
 * Guard de rate limiting por IP usando Redis (janela fixa).
 *
 * Algoritmo: INCR na chave `rl:{ip}:{janela}` + EXPIRE no primeiro hit.
 * Janela = floor(timestamp_segundos / TTL) — garante que o contador
 * reseta exatamente a cada TTL segundos, sem drift.
 *
 * Retorna 429 com headers padrão (X-RateLimit-*) quando o limite é excedido.
 * Endpoints marcados com @Publico() também passam pelo guard, mas rotas
 * de health e métricas devem ser excluídas via allowList abaixo.
 */
@Injectable()
export class ThrottleGuard implements CanActivate {
  private readonly ttl: number;
  private readonly limite: number;

  private static readonly ALLOW_LIST = ['/health', '/health/ready'];

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.ttl = this.config.get('RATE_LIMIT_TTL', { infer: true });
    this.limite = this.config.get('RATE_LIMIT_LIMIT', { infer: true });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    // Ignora rotas de health check
    const prefixo = process.env['API_PREFIX'] ?? 'api';
    const semPrefixo = req.path.replace(new RegExp(`^/${prefixo}`), '');
    if (ThrottleGuard.ALLOW_LIST.some((p) => semPrefixo.startsWith(p))) {
      return true;
    }

    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.ip ??
      'unknown';

    const janela = Math.floor(Date.now() / 1000 / this.ttl);
    const chave = `rl:${ip}:${janela}`;
    const client = this.redis.getClient();

    const pipeline = client.pipeline();
    pipeline.incr(chave);
    pipeline.expire(chave, this.ttl * 2);
    const [[, contagem]] = (await pipeline.exec()) as [[null, number], unknown];

    const restante = Math.max(0, this.limite - contagem);
    res.setHeader('X-RateLimit-Limit', this.limite);
    res.setHeader('X-RateLimit-Remaining', restante);
    res.setHeader('X-RateLimit-Reset', (janela + 1) * this.ttl);

    if (contagem > this.limite) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Muitas requisições. Aguarde e tente novamente.',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
