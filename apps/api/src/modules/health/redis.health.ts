import { Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { RedisService } from '../../infra/redis/redis.service';

/**
 * Indicador de saude custom para o Redis.
 * Executa um PING e reporta up/down conforme a resposta.
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redis: RedisService) {
    super();
  }

  async isHealthy(chave: string): Promise<HealthIndicatorResult> {
    try {
      const ok = await this.redis.ping();
      if (!ok) {
        throw new Error('PING sem PONG');
      }
      return this.getStatus(chave, true);
    } catch (erro) {
      const mensagem =
        erro instanceof Error ? erro.message : 'falha desconhecida';
      throw new HealthCheckError(
        'Redis indisponivel',
        this.getStatus(chave, false, { message: mensagem }),
      );
    }
  }
}
