import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { ServerOptions } from 'socket.io';

/**
 * Adaptador WebSocket com Redis pub/sub.
 *
 * Quando WS_REDIS_ADAPTER=true, o Socket.IO usa dois clientes ioredis
 * (pub/sub) para fazer fan-out de eventos entre réplicas da API.
 * Na Fase 1 (instância única) pode ficar false.
 */
export class WsRedisAdapter extends IoAdapter {
  private readonly logger = new Logger(WsRedisAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async conectarRedis(url: string): Promise<void> {
    const pub = new Redis(url, { maxRetriesPerRequest: null });
    const sub = pub.duplicate();

    pub.on('error', (e) => this.logger.error(`Redis pub: ${e.message}`));
    sub.on('error', (e) => this.logger.error(`Redis sub: ${e.message}`));

    this.adapterConstructor = createAdapter(pub, sub);
    this.logger.log('Adaptador Redis para WebSocket configurado.');
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options) as {
      adapter: (a: unknown) => void;
    };
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
