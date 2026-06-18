import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type { AtualizarCompdecDto } from '../dto/atualizar-compdec.dto';

const UF_MG_ID = 31;

interface FiltrosMunicipio {
  nome?: string;
  regionalId?: string;
  ufId?: number;
}

interface EscopoUsuario {
  escopo: string;
  municipioId: number | null;
  regionalId: string | null;
}

/** Acesso a dados de Município/Regional/COMPDEC (única camada que toca o Prisma). */
@Injectable()
export class LocalidadesRepository {
  constructor(private readonly prisma: PrismaService) {}

  listarTodosMunicipiosMg(): Promise<{ id: number; nome: string }[]> {
    return this.prisma.municipio.findMany({
      where: { ufId: UF_MG_ID },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    });
  }

  async listarMunicipios(
    filtros: FiltrosMunicipio,
    escopo: EscopoUsuario,
    skip: number,
    take: number,
  ) {
    const where: Record<string, unknown> = {};

    // Escopo multi-tenant
    if (escopo.escopo === 'MUNICIPAL' && escopo.municipioId) {
      where.id = escopo.municipioId;
    } else if (escopo.escopo === 'REGIONAL' && escopo.regionalId) {
      where.regionalId = escopo.regionalId;
    }

    if (filtros.nome) where.nome = { contains: filtros.nome, mode: 'insensitive' };
    if (filtros.regionalId) where.regionalId = filtros.regionalId;
    if (filtros.ufId) where.ufId = filtros.ufId;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.municipio.findMany({
        where,
        include: {
          compdec: true,
          regional: { select: { id: true, nome: true } },
          uf: { select: { id: true, sigla: true } },
        },
        orderBy: { nome: 'asc' },
        skip,
        take,
      }),
      this.prisma.municipio.count({ where }),
    ]);

    return { items, total };
  }

  buscarMunicipioPorId(id: number) {
    return this.prisma.municipio.findUnique({
      where: { id },
      include: {
        compdec: true,
        regional: true,
        uf: { select: { id: true, sigla: true, nome: true } },
      },
    });
  }

  async municipioExiste(id: number): Promise<boolean> {
    return !!(await this.prisma.municipio.findUnique({ where: { id }, select: { id: true } }));
  }

  upsertCompdec(municipioId: number, dados: AtualizarCompdecDto) {
    return this.prisma.compdec.upsert({
      where: { municipioId },
      create: { municipioId, ...dados },
      update: { ...dados },
    });
  }

  listarRegionais(ufId?: number) {
    return this.prisma.regional.findMany({
      where: ufId ? { ufId } : undefined,
      include: {
        uf: { select: { sigla: true } },
        _count: { select: { municipios: true } },
      },
      orderBy: { nome: 'asc' },
    });
  }
}
