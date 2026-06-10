import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
} from '@nestjs/terminus';
import { Publico } from '../../common/decorators/publico.decorator';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from './redis.health';

/**
 * Controller de health-check da API.
 *
 * - GET /health        -> liveness: a aplicacao esta de pe (resposta simples).
 * - GET /health/ready  -> readiness: dependencias criticas (PostgreSQL e Redis)
 *                         estao acessiveis.
 *
 * O prefixo global "api" e aplicado em main.ts, entao as rotas finais sao
 * /api/health e /api/health/ready.
 */
@Publico()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
  ) {}

  /** Liveness: indica apenas que o processo esta respondendo. */
  @Get()
  liveness(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /** Readiness: verifica PostgreSQL (SELECT 1) e Redis (ping). */
  @Get('ready')
  @HealthCheck()
  readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaIndicator.isHealthy('postgres'),
      () => this.redisIndicator.isHealthy('redis'),
    ]);
  }
}
