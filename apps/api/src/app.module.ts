import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './config/env.validation';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { HealthModule } from './modules/health/health.module';
import { CommonModule } from './common/common.module';

/**
 * Modulo raiz da aplicacao.
 *
 * - ConfigModule global com validacao Zod das variaveis de ambiente.
 *   envFilePath aponta para a raiz do monorepo (../../.env) e tambem para
 *   um .env local, cobrindo execucao em container e em dev.
 * - PrismaModule e RedisModule sao globais (infra de dados).
 * - HealthModule expoe os health-checks.
 * - CommonModule registra o filtro global de excecoes.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validate,
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    CommonModule,
  ],
})
export class AppModule {}
