import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './controllers/health.controller';
import { PrismaHealthIndicator } from './prisma.health';

/**
 * Modulo de health-check.
 *
 * Usa o @nestjs/terminus para expor os endpoints de liveness e readiness.
 * O PrismaService chega via modulo global (PrismaModule), por isso so
 * registramos aqui o indicador custom.
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator],
})
export class HealthModule {}
