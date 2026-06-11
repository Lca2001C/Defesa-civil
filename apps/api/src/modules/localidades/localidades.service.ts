import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { JwtPayload } from '../../common/types/jwt-payload';
import type { PaginacaoDto } from '../../common/dto/paginacao.dto';
import type { AtualizarCompdecDto } from './dto/atualizar-compdec.dto';

@Injectable()
export class LocalidadesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Municípios ─────────────────────────────────────────────────────────────

  async listarMunicipios(
    paginacao: PaginacaoDto,
    filtros: { nome?: string; regionalId?: string; ufId?: number },
    usuario: JwtPayload,
  ) {
    const pagina = paginacao.pagina ?? 1;
    const porPagina = paginacao.porPagina ?? 20;

    const where: Record<string, unknown> = {};

    // Escopo multi-tenant
    if (usuario.escopo === 'MUNICIPAL' && usuario.municipioId) {
      where.id = usuario.municipioId;
    } else if (usuario.escopo === 'REGIONAL' && usuario.regionalId) {
      where.regionalId = usuario.regionalId;
    }

    if (filtros.nome) {
      where.nome = { contains: filtros.nome, mode: 'insensitive' };
    }
    if (filtros.regionalId) {
      where.regionalId = filtros.regionalId;
    }
    if (filtros.ufId) {
      where.ufId = filtros.ufId;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.municipio.findMany({
        where,
        include: {
          compdec: true,
          regional: { select: { id: true, nome: true } },
          uf: { select: { id: true, sigla: true } },
        },
        orderBy: { nome: 'asc' },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
      }),
      this.prisma.municipio.count({ where }),
    ]);

    return {
      items,
      total,
      pagina,
      porPagina,
      totalPaginas: Math.ceil(total / porPagina),
    };
  }

  async buscarMunicipioPorId(id: number, usuario: JwtPayload) {
    this.verificarEscopoMunicipio(id, usuario);

    const municipio = await this.prisma.municipio.findUnique({
      where: { id },
      include: {
        compdec: true,
        regional: true,
        uf: { select: { id: true, sigla: true, nome: true } },
      },
    });

    if (!municipio) throw new NotFoundException('Município não encontrado.');
    return municipio;
  }

  async atualizarCompdec(
    municipioId: number,
    dto: AtualizarCompdecDto,
    usuario: JwtPayload,
  ) {
    // Apenas ADMIN_MUNICIPAL do próprio município ou perfis estaduais
    if (
      usuario.escopo === 'MUNICIPAL' &&
      usuario.municipioId !== municipioId
    ) {
      throw new ForbiddenException(
        'Você só pode atualizar dados do seu próprio município.',
      );
    }

    const municipio = await this.prisma.municipio.findUnique({
      where: { id: municipioId },
    });
    if (!municipio) throw new NotFoundException('Município não encontrado.');

    return this.prisma.compdec.upsert({
      where: { municipioId },
      create: { municipioId, ...dto },
      update: { ...dto },
    });
  }

  // ── Regionais ──────────────────────────────────────────────────────────────

  async listarRegionais(ufId?: number) {
    return this.prisma.regional.findMany({
      where: ufId ? { ufId } : undefined,
      include: {
        uf: { select: { sigla: true } },
        _count: { select: { municipios: true } },
      },
      orderBy: { nome: 'asc' },
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private verificarEscopoMunicipio(
    municipioId: number,
    usuario: JwtPayload,
  ): void {
    if (
      usuario.escopo === 'MUNICIPAL' &&
      usuario.municipioId !== municipioId
    ) {
      throw new ForbiddenException('Acesso negado a este município.');
    }
  }
}
