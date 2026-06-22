import { Injectable, Logger } from '@nestjs/common';
import type { PaginacaoDto } from '../../../common/dto/paginacao.dto';
import { AuditoriaRepository, type EventoAuditoria } from '../repositories/auditoria.repository';

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly repo: AuditoriaRepository) {}

  /**
   * Registra um evento de auditoria (login, logout, download, export, etc.).
   * Fire-and-forget: falhas de auditoria nunca quebram a operação principal.
   */
  async registrar(evento: EventoAuditoria): Promise<void> {
    try {
      await this.repo.criar(evento);
    } catch (e) {
      this.logger.warn(`Falha ao registrar auditoria: ${(e as Error).message}`);
    }
  }

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
