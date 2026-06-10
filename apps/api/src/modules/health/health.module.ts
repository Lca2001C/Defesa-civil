import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from './redis.health';

/**
 * Modulo de health-check.
 *
 * Usa o @nestjs/terminus para expor os endpoints de liveness e readiness.
 * PrismaService e RedisService chegam via modulos globais (PrismaModule e
 * RedisModule), por isso so registramos aqui os indicadores custom.
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
