import { Injectable } from '@nestjs/common';
import type { PaginacaoDto } from '../../../common/dto/paginacao.dto';
import { AuditoriaRepository } from '../repositories/auditoria.repository';

@Injectable()
export class AuditoriaService {
  constructor(private readonly repo: AuditoriaRepository) {}

  async listar(
    paginacao: PaginacaoDto,
    filtros: { entidade?: string; atorId?: string },
  ) {
    const pagina = paginacao.pagina ?? 1;
    const porPagina = paginacao.porPagina ?? 50;
    const { items, total } = await this.repo.listar(filtros, (pagina - 1) * porPagina, porPagina);
    return { items, total, pagina, porPagina, totalPaginas: Math.ceil(total / porPagina) };
  }
}
