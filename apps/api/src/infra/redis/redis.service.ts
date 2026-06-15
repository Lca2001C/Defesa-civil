import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Env } from '../../config/env.validation';

/**
 * Servico de acesso ao Redis.
 *
 * Cria um cliente ioredis a partir da variavel REDIS_URL e gerencia
 * seu ciclo de vida: conecta no boot e encerra a conexao (quit) no
 * desligamento do modulo.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly config: ConfigService<Env, true>) {
    const url = this.config.get('REDIS_URL', { infer: true });
    this.client = new Redis(url, {
      // Em ambiente de container, evita derrubar o processo enquanto o
      // Redis ainda esta subindo; o ioredis tenta reconectar sozinho.
      lazyConnect: false,
      maxRetriesPerRequest: null,
    });

    this.client.on('error', (erro) => {
      this.logger.error(`Erro no cliente Redis: ${erro.message}`);
    });
  }

  onModuleInit(): void {
    this.logger.log('Cliente Redis inicializado.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
    this.logger.log('Conexao com o Redis encerrada.');
  }

  /** Retorna a instancia do cliente ioredis para uso direto. */
  getClient(): Redis {
    return this.client;
  }

  /** Verifica a disponibilidade do Redis. Retorna true se o PING responder "PONG". */
  async ping(): Promise<boolean> {
    const resposta = await this.client.ping();
    return resposta === 'PONG';
  }

  // ── Abstração de cache (JSON) ──────────────────────────────────────────────

  /** Lê um valor JSON do cache. Retorna null se ausente ou inválido. */
  async cacheGet<T>(chave: string): Promise<T | null> {
    const bruto = await this.client.get(chave);
    if (!bruto) return null;
    try {
      return JSON.parse(bruto) as T;
    } catch {
      return null;
    }
  }

  /** Grava um valor JSON no cache com TTL em segundos. */
  async cacheSet(chave: string, valor: unknown, ttlSeg: number): Promise<void> {
    await this.client.setex(chave, ttlSeg, JSON.stringify(valor));
  }

  /**
   * Remove todas as chaves que começam com o prefixo informado.
   * Usa SCAN (não KEYS) para não bloquear o Redis em bases grandes.
   */
  async cacheDelPorPrefixo(prefixo: string): Promise<void> {
    const stream = this.client.scanStream({ match: `${prefixo}*`, count: 100 });
    const pipeline = this.client.pipeline();
    let pendentes = 0;

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chaves: string[]) => {
        for (const chave of chaves) {
          pipeline.del(chave);
          pendentes++;
        }
      });
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    if (pendentes > 0) await pipeline.exec();
  }
}
