import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { validate } from './config/env.validation';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { HealthModule } from './modules/health/health.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/auth/auth.module';
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
    PrismaModule,
    RedisModule,
    HealthModule,
    CommonModule,
    AuthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
