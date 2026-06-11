import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { validate } from './config/env.validation';
import type { Env } from './config/env.validation';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { StorageModule } from './infra/storage/storage.module';
import { HealthModule } from './modules/health/health.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompetenciasModule } from './modules/competencias/competencias.module';
import { FormulariosModule } from './modules/formularios/formularios.module';
import { ExcelModule } from './modules/excel/excel.module';
import { ImportacaoModule } from './modules/importacao/importacao.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RbacGuard } from './common/guards/rbac.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

/**
 * Modulo raiz da aplicacao.
 *
 * Guards globais (ordem importa — autenticacao antes de autorizacao):
 *  1. JwtAuthGuard — valida o Bearer token e popula req.user.
 *  2. RbacGuard    — verifica permissoes (@Permissao) apos autenticacao.
 * Interceptor global:
 *  - AuditInterceptor — registra LogAuditoria para mutacoes (POST/PUT/PATCH/DELETE).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validate,
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: { url: config.get('REDIS_URL', { infer: true }) },
      }),
    }),
    PrismaModule,
    RedisModule,
    StorageModule,
    HealthModule,
    CommonModule,
    AuthModule,
    CompetenciasModule,
    FormulariosModule,
    ExcelModule,
    ImportacaoModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
