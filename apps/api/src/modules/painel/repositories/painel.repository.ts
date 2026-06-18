import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';

/** ID IBGE da UF de Minas Gerais. */
const UF_MG_ID = 31;

/** Acesso a dados do painel (agregações e leituras — única camada que toca o Prisma). */
@Injectable()
export class PainelRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Agregação município×status (no máx. ~853×6 linhas, independente do volume). */
  agruparStatusPorMunicipio(competenciaId: string, formularioVersaoId?: string) {
    return this.prisma.submissao.groupBy({
      by: ['municipioId', 'status'],
      where: {
        competenciaId,
        ...(formularioVersaoId ? { formularioVersaoId } : {}),
        municipio: { ufId: UF_MG_ID },
      },
    });
  }

  /** IDs dos municípios de MG. */
  async listarMunicipiosMgIds(): Promise<number[]> {
    const municipios = await this.prisma.municipio.findMany({
      where: { ufId: UF_MG_ID },
      select: { id: true },
    });
    return municipios.map((m) => m.id);
  }

  buscarMunicipioComCompdec(municipioId: number) {
    return this.prisma.municipio.findUnique({
      where: { id: municipioId },
      include: { compdec: true },
    });
  }

  listarSubmissoesRecentes(municipioId: number, competenciaId: string) {
    return this.prisma.submissao.findMany({
      where: { municipioId, competenciaId },
      orderBy: { criadoEm: 'desc' },
      take: 5,
      select: {
        id: true,
        protocolo: true,
        status: true,
        nomeRespondente: true,
        criadoEm: true,
      },
    });
  }
}
