import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

/** Intervalo da varredura de expiração (ms). */
const SWEEP_INTERVAL_MS = 60_000;

interface Entrada {
  valor: unknown;
  /** Epoch em ms em que a entrada expira (Infinity = sem expiração). */
  expiraEm: number;
}

/**
 * Cache/contadores em memória (processo único).
 *
 * Substitui o Redis na arquitetura simplificada: como a aplicação roda em uma
 * única instância, um Map local atende cache de leitura (painel/localidades),
 * contadores de rate limit e o lockout de login. A expiração é preguiçosa
 * (verificada na leitura) com uma varredura periódica leve para liberar memória.
 *
 * NÃO use para estado que precise sobreviver a reinícios — para isso, persista
 * no PostgreSQL (ex.: refresh tokens).
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly store = new Map<string, Entrada>();
  private sweepTimer: NodeJS.Timeout | null = null;

  onModuleInit(): void {
    this.sweepTimer = setInterval(() => this.limparExpirados(), SWEEP_INTERVAL_MS);
    // Não impedir o encerramento do processo por causa do timer.
    this.sweepTimer.unref?.();
    this.logger.log('Cache em memória inicializado.');
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  // ── API genérica de cache (JSON) ───────────────────────────────────────────

  cacheGet<T>(chave: string): Promise<T | null> {
    const entrada = this.store.get(chave);
    if (!entrada) return Promise.resolve(null);
    if (this.expirada(chave, entrada)) return Promise.resolve(null);
    return Promise.resolve(entrada.valor as T);
  }

  cacheSet(chave: string, valor: unknown, ttlSeg: number): Promise<void> {
    this.store.set(chave, { valor, expiraEm: Date.now() + ttlSeg * 1000 });
    return Promise.resolve();
  }

  /** Remove todas as chaves que começam com o prefixo informado. */
  cacheDelPorPrefixo(prefixo: string): Promise<void> {
    for (const chave of this.store.keys()) {
      if (chave.startsWith(prefixo)) this.store.delete(chave);
    }
    return Promise.resolve();
  }

  del(chave: string): Promise<void> {
    this.store.delete(chave);
    return Promise.resolve();
  }

  // ── Contadores com TTL (rate limit / lockout) ──────────────────────────────

  /**
   * Incrementa um contador, definindo o TTL na primeira ocorrência (janela fixa),
   * e devolve o novo valor.
   */
  incr(chave: string, ttlSeg: number): Promise<number> {
    const entrada = this.store.get(chave);
    if (!entrada || this.expirada(chave, entrada)) {
      this.store.set(chave, { valor: 1, expiraEm: Date.now() + ttlSeg * 1000 });
      return Promise.resolve(1);
    }
    const novo = (entrada.valor as number) + 1;
    entrada.valor = novo; // mantém a janela (expiraEm) original
    return Promise.resolve(novo);
  }

  /** Valor atual de um contador (0 se ausente/expirado). */
  getNumero(chave: string): Promise<number> {
    const entrada = this.store.get(chave);
    if (!entrada || this.expirada(chave, entrada)) return Promise.resolve(0);
    return Promise.resolve(Number(entrada.valor) || 0);
  }

  // ── Manutenção ─────────────────────────────────────────────────────────────

  private expirada(chave: string, entrada: Entrada): boolean {
    if (entrada.expiraEm <= Date.now()) {
      this.store.delete(chave);
      return true;
    }
    return false;
  }

  /** Varredura periódica para liberar entradas expiradas (chamada pelo módulo). */
  limparExpirados(): void {
    const agora = Date.now();
    for (const [chave, entrada] of this.store) {
      if (entrada.expiraEm <= agora) this.store.delete(chave);
    }
  }
}
