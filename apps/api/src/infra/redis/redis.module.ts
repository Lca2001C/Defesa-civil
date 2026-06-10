import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Modulo global do Redis.
 *
 * Por ser @Global, o RedisService fica disponivel para injecao em
 * qualquer modulo da aplicacao sem necessidade de reimportar.
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
