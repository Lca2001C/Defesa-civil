import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { validate } from './config/env.validation';
import type { Env } from './config/env.validation';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { StorageModule } from './infra/storage/storage.module';
import { HttpLoggerMiddleware } from './infra/middleware/http-logger.middleware';
import { HealthModule } from './modules/health/health.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompetenciasModule } from './modules/competencias/competencias.module';
import { FormulariosModule } from './modules/formularios/formularios.module';
import { SubmissoesModule } from './modules/submissoes/submissoes.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { PainelModule } from './modules/painel/painel.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { RelatoriosModule } from './modules/relatorios/relatorios.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { LocalidadesModule } from './modules/localidades/localidades.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { NotificacoesModule } from './modules/notificacoes/notificacoes.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RbacGuard } from './common/guards/rbac.guard';
import { ThrottleGuard } from './common/guards/throttle.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

/**
 * Módulo raiz da aplicação.
 *
 * Guards globais (ordem importa):
 *  1. ThrottleGuard  — rate limiting por IP via Redis (429 quando excede).
 *  2. JwtAuthGuard   — valida Bearer token e popula req.user.
 *  3. RbacGuard      — verifica permissões (@Permissao) após autenticação.
 * Interceptor global:
 *  - AuditInterceptor — LogAuditoria para mutações, com campos sensíveis redactados.
 * Middleware global:
 *  - HttpLoggerMiddleware — correlation ID (X-Request-ID) + access log JSON.
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
    SubmissoesModule,
    RealtimeModule,
    PainelModule,
    DashboardModule,
    RelatoriosModule,
    UsuariosModule,
    LocalidadesModule,
    AuditoriaModule,
    NotificacoesModule,
  ],
  providers: [
    ThrottleGuard,
    { provide: APP_GUARD, useClass: ThrottleGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(HttpLoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
