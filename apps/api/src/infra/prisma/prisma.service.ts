import {
  Injectable,
  Logger,
  type INestApplication,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Servico de acesso ao banco via Prisma.
 *
 * Estende o PrismaClient e gerencia o ciclo de vida da conexao:
 * conecta no boot do modulo e registra os shutdown hooks do Nest
 * para encerrar a conexao de forma limpa no desligamento.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conexao com o PostgreSQL estabelecida (Prisma).');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Conexao com o PostgreSQL encerrada (Prisma).');
  }

  /**
   * Registra listener `beforeExit` para fechar o app quando o event loop
   * esvazia naturalmente (complementa o SIGTERM tratado por enableShutdownHooks).
   */
  enableShutdownHooks(app: INestApplication): void {
    process.on('beforeExit', () => {
      void app.close();
    });
  }
}
