import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permissao } from '../../../common/decorators/permissao.decorator';
import { PaginacaoDto } from '../../../common/dto/paginacao.dto';
import { AuditoriaService } from '../services/auditoria.service';

@ApiBearerAuth()
@ApiTags('auditoria')
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly service: AuditoriaService) {}

  @Get()
  @Permissao('auditoria.ler')
  @ApiOperation({ summary: 'Lista logs de auditoria com filtros.' })
  @ApiQuery({ name: 'entidade', required: false })
  @ApiQuery({ name: 'atorId', required: false })
  listar(
    @Query() paginacao: PaginacaoDto,
    @Query('entidade') entidade?: string,
    @Query('atorId') atorId?: string,
  ) {
    return this.service.listar(paginacao, { entidade, atorId });
  }
}
