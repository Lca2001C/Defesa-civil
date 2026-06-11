import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompetenciaStatus } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { CriarCompetenciaDto } from './dto/criar-competencia.dto';
import type { AtualizarCompetenciaDto } from './dto/atualizar-competencia.dto';
import type { PaginacaoDto } from '../../common/dto/paginacao.dto';

@Injectable()
export class CompetenciasService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(dto: CriarCompetenciaDto) {
    return this.prisma.competencia.create({
      data: {
        nome: dto.nome,
        ano: dto.ano,
        dataInicio: new Date(dto.dataInicio),
        dataFim: new Date(dto.dataFim),
        status: CompetenciaStatus.PLANEJADA,
      },
    });
  }

  async buscarTodos(
    paginacao: PaginacaoDto,
    filtros: { ano?: number; status?: CompetenciaStatus },
  ) {
    const pagina = paginacao.pagina ?? 1;
    const porPagina = paginacao.porPagina ?? 20;
    const skip = (pagina - 1) * porPagina;

    const where = {
      ...(filtros.ano !== undefined ? { ano: filtros.ano } : {}),
      ...(filtros.status ? { status: filtros.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.competencia.findMany({
        where,
        skip,
        take: porPagina,
        orderBy: [{ ano: 'desc' }, { dataInicio: 'desc' }],
      }),
      this.prisma.competencia.count({ where }),
    ]);

    return { items, total, pagina, porPagina, totalPaginas: Math.ceil(total / porPagina) };
  }

  async buscarPorId(id: string) {
    const comp = await this.prisma.competencia.findUnique({ where: { id } });
    if (!comp) throw new NotFoundException(`Competência '${id}' não encontrada.`);
    return comp;
  }

  async atualizar(id: string, dto: AtualizarCompetenciaDto) {
    await this.buscarPorId(id);
    return this.prisma.competencia.update({
      where: { id },
      data: {
        ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
        ...(dto.ano !== undefined ? { ano: dto.ano } : {}),
        ...(dto.dataInicio !== undefined ? { dataInicio: new Date(dto.dataInicio) } : {}),
        ...(dto.dataFim !== undefined ? { dataFim: new Date(dto.dataFim) } : {}),
      },
    });
  }

  async abrir(id: string) {
    const comp = await this.buscarPorId(id);
    if (comp.status !== CompetenciaStatus.PLANEJADA) {
      throw new BadRequestException(
        `Somente competências PLANEJADAS podem ser abertas. Status atual: ${comp.status}.`,
      );
    }
    return this.prisma.competencia.update({
      where: { id },
      data: { status: CompetenciaStatus.ABERTA },
    });
  }

  async encerrar(id: string) {
    const comp = await this.buscarPorId(id);
    if (comp.status !== CompetenciaStatus.ABERTA) {
      throw new BadRequestException(
        `Somente competências ABERTAS podem ser encerradas. Status atual: ${comp.status}.`,
      );
    }
    return this.prisma.competencia.update({
      where: { id },
      data: { status: CompetenciaStatus.ENCERRADA },
    });
  }
}
