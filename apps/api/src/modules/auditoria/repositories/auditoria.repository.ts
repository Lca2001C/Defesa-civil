import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';

interface FiltrosAuditoria {
  entidade?: string;
  atorId?: string;
}

/** Dados de um evento de auditoria a registrar. */
export interface EventoAuditoria {
  atorId?: string | null;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  depois?: object;
}

/** Acesso a dados dos logs de auditoria (única camada que toca o Prisma). */
@Injectable()
export class AuditoriaRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Registra um evento de auditoria. */
  async criar(evento: EventoAuditoria): Promise<void> {
    await this.prisma.logAuditoria.create({
      data: {
        atorId: evento.atorId ?? null,
        acao: evento.acao,
        entidade: evento.entidade,
        entidadeId: evento.entidadeId ?? null,
        ip: evento.ip ?? null,
        userAgent: evento.userAgent ?? null,
        depois: evento.depois,
      },
    });
  }

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
