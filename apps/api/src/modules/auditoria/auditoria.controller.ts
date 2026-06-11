import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permissao } from '../../common/decorators/permissao.decorator';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PaginacaoDto } from '../../common/dto/paginacao.dto';

@ApiBearerAuth()
@ApiTags('auditoria')
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Permissao('auditoria.ler')
  @ApiOperation({ summary: 'Lista logs de auditoria com filtros.' })
  @ApiQuery({ name: 'entidade', required: false })
  @ApiQuery({ name: 'atorId', required: false })
  async listar(
    @Query() paginacao: PaginacaoDto,
    @Query('entidade') entidade?: string,
    @Query('atorId') atorId?: string,
  ) {
    const pagina = paginacao.pagina ?? 1;
    const porPagina = paginacao.porPagina ?? 50;

    const where: Record<string, unknown> = {};
    if (entidade) where.entidade = entidade;
    if (atorId) where.atorId = atorId;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.logAuditoria.findMany({
        where,
        include: {
          ator: { select: { nome: true, email: true } },
        },
        orderBy: { criadoEm: 'desc' },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
      }),
      this.prisma.logAuditoria.count({ where }),
    ]);

    return {
      items,
      total,
      pagina,
      porPagina,
      totalPaginas: Math.ceil(total / porPagina),
    };
  }
}
