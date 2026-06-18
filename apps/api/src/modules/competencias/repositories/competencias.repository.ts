import { Injectable } from '@nestjs/common';
import { Competencia, CompetenciaStatus } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';

interface FiltrosCompetencia {
  ano?: number;
  status?: CompetenciaStatus;
}

interface DadosCompetencia {
  nome: string;
  ano: number;
  dataInicio: Date;
  dataFim: Date;
}

/** Acesso a dados de Competência (única camada que toca o Prisma). */
@Injectable()
export class CompetenciasRepository {
  constructor(private readonly prisma: PrismaService) {}

  criar(dados: DadosCompetencia): Promise<Competencia> {
    return this.prisma.competencia.create({
      data: { ...dados, status: CompetenciaStatus.PLANEJADA },
    });
  }

  async listar(
    filtros: FiltrosCompetencia,
    skip: number,
    take: number,
  ): Promise<{ items: Competencia[]; total: number }> {
    const where = {
      ...(filtros.ano !== undefined ? { ano: filtros.ano } : {}),
      ...(filtros.status ? { status: filtros.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.competencia.findMany({
        where,
        skip,
        take,
        orderBy: [{ ano: 'desc' }, { dataInicio: 'desc' }],
      }),
      this.prisma.competencia.count({ where }),
    ]);

    return { items, total };
  }

  buscarPorId(id: string): Promise<Competencia | null> {
    return this.prisma.competencia.findUnique({ where: { id } });
  }

  atualizar(id: string, dados: Partial<DadosCompetencia>): Promise<Competencia> {
    return this.prisma.competencia.update({ where: { id }, data: dados });
  }

  atualizarStatus(id: string, status: CompetenciaStatus): Promise<Competencia> {
    return this.prisma.competencia.update({ where: { id }, data: { status } });
  }
}
