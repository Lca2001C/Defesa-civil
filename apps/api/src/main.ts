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
import { resolverOrigensCors } from './shared/cors.util';

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

  // Seguranca de cabecalhos HTTP + CSP conservadora (compatível com a SPA
  // MUI/Emotion, que usa estilos inline). `connect-src` libera self + WS/WSS
  // para o painel em tempo real.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Compressao gzip das respostas (painel/status, dashboard, listas grandes).
  app.use(compression());

  // CORS: lista branca via CORS_ORIGINS (compartilhada com o WebSocket).
  // Vazia => libera tudo só fora de produção; em produção a validate() do Zod
  // já impede o boot sem origens definidas.
  app.enableCors({
    origin: resolverOrigensCors(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86_400,
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
