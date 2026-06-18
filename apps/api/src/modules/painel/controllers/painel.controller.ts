import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PainelService } from '../services/painel.service';
import { Permissao } from '../../../common/decorators/permissao.decorator';

@ApiTags('Painel')
@Controller('painel')
export class PainelController {
  constructor(private readonly service: PainelService) {}

  @Get('status')
  @Permissao('painel.ver')
  @ApiOperation({ summary: 'Status de todos os municípios de MG para uma competência.' })
  buscarStatus(
    @Query('competenciaId') competenciaId: string,
    @Query('formularioVersaoId') formularioVersaoId?: string,
  ) {
    return this.service.buscarStatusMunicipios(competenciaId, formularioVersaoId);
  }

  @Get('stats')
  @Permissao('painel.ver')
  @ApiOperation({ summary: 'Estatísticas agregadas: contadores por status.' })
  buscarEstatisticas(@Query('competenciaId') competenciaId: string) {
    return this.service.buscarEstatisticas(competenciaId);
  }

  @Get('municipio/:id')
  @Permissao('painel.ver')
  @ApiOperation({ summary: 'Dados do drawer de um município (COMPDEC + submissões).' })
  buscarDrawer(
    @Param('id', ParseIntPipe) id: number,
    @Query('competenciaId') competenciaId: string,
  ) {
    return this.service.buscarDrawerMunicipio(id, competenciaId);
  }
}
