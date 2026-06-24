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
import { CacheService } from '../../infra/cache/cache.service';
import { extrairIp } from '../../shared/utils/format.util';
import { RATE_LIMIT_PREFIX } from '../../shared/constants';

/**
 * Guard de rate limiting por IP usando o cache em memória (janela fixa).
 *
 * Algoritmo: incr na chave `rl:{ip}:{janela}` com TTL = 2*janela; a janela =
 * floor(timestamp_segundos / TTL) garante reset a cada TTL segundos sem drift.
 *
 * Instância única: contador em memória basta. Em caso de múltiplas réplicas no
 * futuro, voltar a uma store compartilhada.
 */
@Injectable()
export class ThrottleGuard implements CanActivate {
  private readonly ttl: number;
  private readonly limite: number;

  private static readonly ALLOW_LIST = ['/health', '/health/ready'];

  constructor(
    private readonly cache: CacheService,
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

    const ip = extrairIp(req);

    const janela = Math.floor(Date.now() / 1000 / this.ttl);
    const chave = `${RATE_LIMIT_PREFIX}${ip}:${janela}`;

    const contagem = await this.cache.incr(chave, this.ttl * 2);

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
