import { Injectable } from '@nestjs/common';
import { SubmissaoStatus } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';

const UF_MG_ID = 31;

/** Escopo multi-tenant do solicitante, aplicado às consultas. */
export interface EscopoDashboard {
  escopo: string;
  municipioId: number | null;
  regionalId: string | null;
}

const STATUS_RESPONDIDO_NOT_IN = [SubmissaoStatus.RASCUNHO, SubmissaoStatus.EM_PREENCHIMENTO];

/** Acesso a dados das agregações do dashboard (única camada que toca o Prisma). */
@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Fragmento de `where` de submissão conforme o escopo do usuário. */
  private escopoSubmissaoWhere(escopo: EscopoDashboard): object {
    if (escopo.escopo === 'MUNICIPAL' && escopo.municipioId) {
      return { municipioId: escopo.municipioId };
    }
    if (escopo.escopo === 'REGIONAL' && escopo.regionalId) {
      return { municipio: { regionalId: escopo.regionalId } };
    }
    return {};
  }

  agruparPorStatus(competenciaId: string, escopo: EscopoDashboard) {
    return this.prisma.submissao.groupBy({
      by: ['status'],
      where: { competenciaId, ...this.escopoSubmissaoWhere(escopo) },
      _count: { id: true },
    });
  }

  contarMunicipiosNoEscopo(escopo: EscopoDashboard): Promise<number> {
    return this.prisma.municipio.count({
      where:
        escopo.escopo === 'MUNICIPAL' && escopo.municipioId
          ? { id: escopo.municipioId }
          : escopo.escopo === 'REGIONAL' && escopo.regionalId
            ? { regionalId: escopo.regionalId }
            : { ufId: UF_MG_ID },
    });
  }

  listarParaTimeline(competenciaId: string, desde: Date, escopo: EscopoDashboard) {
    return this.prisma.submissao.findMany({
      where: {
        competenciaId,
        criadoEm: { gte: desde },
        status: { notIn: STATUS_RESPONDIDO_NOT_IN },
        ...this.escopoSubmissaoWhere(escopo),
      },
      select: { criadoEm: true, status: true },
      orderBy: { criadoEm: 'asc' },
    });
  }

  /**
   * Agrega por município×status (no SQL) + resolve as regionais dos municípios
   * presentes. Evita trazer uma linha por submissão para contar em JS.
   */
  async agruparPorRegional(competenciaId: string, escopo: EscopoDashboard) {
    const grupos = await this.prisma.submissao.groupBy({
      by: ['municipioId', 'status'],
      where: {
        competenciaId,
        status: { notIn: STATUS_RESPONDIDO_NOT_IN },
        ...this.escopoSubmissaoWhere(escopo),
      },
      _count: { _all: true },
    });

    const municipioIds = [...new Set(grupos.map((g) => g.municipioId))];
    const municipios = municipioIds.length
      ? await this.prisma.municipio.findMany({
          where: { id: { in: municipioIds } },
          select: { id: true, regional: { select: { id: true, nome: true } } },
        })
      : [];

    return { grupos, municipios };
  }

  /** Agrega por versão de formulário×status (no SQL) + resolve os nomes. */
  async agruparPorFormulario(competenciaId: string, escopo: EscopoDashboard) {
    const grupos = await this.prisma.submissao.groupBy({
      by: ['formularioVersaoId', 'status'],
      where: {
        competenciaId,
        status: { notIn: STATUS_RESPONDIDO_NOT_IN },
        ...this.escopoSubmissaoWhere(escopo),
      },
      _count: { _all: true },
    });

    const versaoIds = [...new Set(grupos.map((g) => g.formularioVersaoId))];
    const versoes = versaoIds.length
      ? await this.prisma.formularioVersao.findMany({
          where: { id: { in: versaoIds } },
          select: { id: true, versao: true, formulario: { select: { id: true, nome: true } } },
        })
      : [];

    return { grupos, versoes };
  }
}
