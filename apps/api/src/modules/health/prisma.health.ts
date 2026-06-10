import { Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * Indicador de saude custom para o PostgreSQL (via Prisma).
 * Executa um SELECT 1 e reporta up/down conforme o resultado.
 */
@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(chave: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(chave, true);
    } catch (erro) {
      const mensagem =
        erro instanceof Error ? erro.message : 'falha desconhecida';
      throw new HealthCheckError(
        'PostgreSQL indisponivel',
        this.getStatus(chave, false, { message: mensagem }),
      );
    }
  }
}
