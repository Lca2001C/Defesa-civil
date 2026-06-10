import {
  Injectable,
  Logger,
  OnModuleInit,
  type INestApplication,
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
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conexao com o PostgreSQL estabelecida (Prisma).');
  }

  /**
   * Habilita o encerramento gracioso: ao receber o evento de shutdown
   * do Prisma, fecha a aplicacao Nest (que dispara onModuleDestroy etc.).
   */
  enableShutdownHooks(app: INestApplication): void {
    process.on('beforeExit', () => {
      void app.close();
    });
  }
}
