import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissao } from '../../common/decorators/permissao.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import type { JwtPayload } from '../../common/types/jwt-payload';
import { DashboardService } from './dashboard.service';
import { FiltrosDashboardDto, FiltrosTimelineDto } from './dto/filtros-dashboard.dto';

@ApiBearerAuth()
@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('resumo')
  @Permissao('painel.ver')
  @ApiOperation({ summary: 'Resumo de submissões por status para a competência.' })
  resumo(
    @Query() filtros: FiltrosDashboardDto,
    @UsuarioAtual() usuario?: JwtPayload,
  ) {
    return this.service.buscarResumo(filtros.competenciaId, usuario!);
  }

  @Get('timeline')
  @Permissao('painel.ver')
  @ApiOperation({ summary: 'Submissões enviadas/validadas por dia (últimos N dias).' })
  timeline(
    @Query() filtros: FiltrosTimelineDto,
    @UsuarioAtual() usuario?: JwtPayload,
  ) {
    return this.service.buscarTimeline(filtros.competenciaId, filtros.dias ?? 30, usuario!);
  }

  @Get('por-regional')
  @Permissao('painel.ver')
  @ApiOperation({ summary: 'Totais de submissões agrupados por regional (REDEC).' })
  porRegional(
    @Query() filtros: FiltrosDashboardDto,
    @UsuarioAtual() usuario?: JwtPayload,
  ) {
    return this.service.buscarPorRegional(filtros.competenciaId, usuario!);
  }

  @Get('por-formulario')
  @Permissao('painel.ver')
  @ApiOperation({ summary: 'Totais de submissões agrupados por formulário/versão.' })
  porFormulario(
    @Query() filtros: FiltrosDashboardDto,
    @UsuarioAtual() usuario?: JwtPayload,
  ) {
    return this.service.buscarPorFormulario(filtros.competenciaId, usuario!);
  }
}
