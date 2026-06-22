import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Competencia, CompetenciaStatus } from '@prisma/client';
import { CompetenciasRepository } from '../repositories/competencias.repository';
import type { CriarCompetenciaDto } from '../dtos/criar-competencia.dto';
import type { AtualizarCompetenciaDto } from '../dtos/atualizar-competencia.dto';
import type { PaginacaoDto } from '../../../common/dto/paginacao.dto';

@Injectable()
export class CompetenciasService {
  constructor(private readonly repo: CompetenciasRepository) {}

  criar(dto: CriarCompetenciaDto): Promise<Competencia> {
    return this.repo.criar({
      nome: dto.nome,
      ano: dto.ano,
      dataInicio: new Date(dto.dataInicio),
      dataFim: new Date(dto.dataFim),
    });
  }

  async buscarTodos(
    paginacao: PaginacaoDto,
    filtros: { ano?: number; status?: CompetenciaStatus },
  ) {
    const pagina = paginacao.pagina ?? 1;
    const porPagina = paginacao.porPagina ?? 20;
    const { items, total } = await this.repo.listar(filtros, (pagina - 1) * porPagina, porPagina);
    return { items, total, pagina, porPagina, totalPaginas: Math.ceil(total / porPagina) };
  }

  async buscarPorId(id: string): Promise<Competencia> {
    const comp = await this.repo.buscarPorId(id);
    if (!comp) throw new NotFoundException(`Competência '${id}' não encontrada.`);
    return comp;
  }

  async atualizar(id: string, dto: AtualizarCompetenciaDto): Promise<Competencia> {
    await this.buscarPorId(id);
    return this.repo.atualizar(id, {
      ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
      ...(dto.ano !== undefined ? { ano: dto.ano } : {}),
      ...(dto.dataInicio !== undefined ? { dataInicio: new Date(dto.dataInicio) } : {}),
      ...(dto.dataFim !== undefined ? { dataFim: new Date(dto.dataFim) } : {}),
    });
  }

  async abrir(id: string): Promise<Competencia> {
    const comp = await this.buscarPorId(id);
    if (comp.status !== CompetenciaStatus.PLANEJADA) {
      throw new BadRequestException(
        `Somente competências PLANEJADAS podem ser abertas. Status atual: ${comp.status}.`,
      );
    }
    return this.repo.atualizarStatus(id, CompetenciaStatus.ABERTA);
  }

  async encerrar(id: string): Promise<Competencia> {
    const comp = await this.buscarPorId(id);
    if (comp.status !== CompetenciaStatus.ABERTA) {
      throw new BadRequestException(
        `Somente competências ABERTAS podem ser encerradas. Status atual: ${comp.status}.`,
      );
    }
    return this.repo.atualizarStatus(id, CompetenciaStatus.ENCERRADA);
  }
}
