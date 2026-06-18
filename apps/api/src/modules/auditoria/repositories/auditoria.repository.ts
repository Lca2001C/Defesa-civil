import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';

interface FiltrosAuditoria {
  entidade?: string;
  atorId?: string;
}

/** Acesso a dados dos logs de auditoria (única camada que toca o Prisma). */
@Injectable()
export class AuditoriaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtros: FiltrosAuditoria, skip: number, take: number) {
    const where: Record<string, unknown> = {};
    if (filtros.entidade) where.entidade = filtros.entidade;
    if (filtros.atorId) where.atorId = filtros.atorId;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.logAuditoria.findMany({
        where,
        include: { ator: { select: { nome: true, email: true } } },
        orderBy: { criadoEm: 'desc' },
        skip,
        take,
      }),
      this.prisma.logAuditoria.count({ where }),
    ]);

    return { items, total };
  }
}
