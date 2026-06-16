import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import type { Env } from './config/env.validation';
import { PrismaService } from './infra/prisma/prisma.service';
import { WsRedisAdapter } from './infra/realtime/ws-redis.adapter';

/**
 * Bootstrap da API NestJS da Plataforma Defesa Civil MG.
 *
 * Toda a configuracao vem de variaveis de ambiente (principio
 * "build once, deploy anywhere"): nada de host/porta fixos no codigo.
 */
// Serializa BigInt como número no JSON (ex.: Arquivo.tamanhoBytes até 50 GB,
// bem abaixo de 2^53). Sem isto, JSON.stringify lança em respostas com BigInt.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (
  this: bigint,
) {
  return Number(this);
};

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  // ConfigService tipado e estritamente validado (validate do Zod).
  const config = app.get(ConfigService<Env, true>);
  const porta = config.get('PORT', { infer: true });
  const prefixo = config.get('API_PREFIX', { infer: true });
  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });

  // Seguranca de cabecalhos HTTP.
  app.use(helmet());

  // Compressao gzip das respostas (painel/status, dashboard, listas grandes).
  app.use(compression());

  // CORS: converte a lista CSV em array; vazio => libera todas as origens.
  const origens = corsOrigins
    .split(',')
    .map((origem) => origem.trim())
    .filter((origem) => origem.length > 0);
  app.enableCors({
    origin: origens.length > 0 ? origens : true,
    credentials: true,
  });

  // Prefixo global: todas as rotas ficam sob /{API_PREFIX}.
  app.setGlobalPrefix(prefixo);

  // Validacao automatica de DTOs.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // WebSocket adapter (com Redis se WS_REDIS_ADAPTER=true)
  const wsAdapter = new WsRedisAdapter(app);
  if (config.get('WS_REDIS_ADAPTER', { infer: true })) {
    const redisUrl = config.get('REDIS_URL', { infer: true });
    await wsAdapter.conectarRedis(redisUrl);
  }
  app.useWebSocketAdapter(wsAdapter);

  // Encerramento gracioso da conexao com o banco.
  app.enableShutdownHooks();
  const prisma = app.get(PrismaService);
  prisma.enableShutdownHooks(app);

  // Documentacao Swagger em /{API_PREFIX}/docs.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('API Defesa Civil MG')
    .setDescription(
      'API da Plataforma Defesa Civil MG — fundacao (Fase 1).',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const documento = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${prefixo}/docs`, app, documento);

  await app.listen(porta, '0.0.0.0');
  logger.log(
    `API ouvindo em http://0.0.0.0:${porta}/${prefixo} (docs em /${prefixo}/docs)`,
  );
}

void bootstrap();
