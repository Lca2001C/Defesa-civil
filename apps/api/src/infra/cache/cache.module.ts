import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * Módulo global de cache em memória (substitui o RedisModule).
 *
 * Por ser @Global, o CacheService fica disponível para injeção em qualquer
 * módulo sem reimportar.
 */
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
