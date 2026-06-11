import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissao } from '../../common/decorators/permissao.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import type { JwtPayload } from '../../common/types/jwt-payload';
import { AtualizarCompdecDto } from './dto/atualizar-compdec.dto';
import { FiltrosMunicipioDto } from './dto/filtros-municipio.dto';
import { LocalidadesService } from './localidades.service';

@ApiBearerAuth()
@ApiTags('localidades')
@Controller()
export class LocalidadesController {
  constructor(private readonly service: LocalidadesService) {}

  // ── Municípios ─────────────────────────────────────────────────────────────

  @Get('municipios')
  @Permissao('painel.ver')
  @ApiOperation({ summary: 'Lista municípios com dados da COMPDEC.' })
  listarMunicipios(
    @Query() filtros: FiltrosMunicipioDto,
    @UsuarioAtual() usuario?: JwtPayload,
  ) {
    const { pagina, porPagina, nome, regionalId, ufId } = filtros;
    return this.service.listarMunicipios(
      { pagina, porPagina },
      { nome, regionalId, ufId },
      usuario!,
    );
  }

  @Get('municipios/:id')
  @Permissao('painel.ver')
  @ApiOperation({ summary: 'Detalhe de um município com COMPDEC e regional.' })
  buscarMunicipioPorId(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioAtual() usuario?: JwtPayload,
  ) {
    return this.service.buscarMunicipioPorId(id, usuario!);
  }

  @Patch('municipios/:id/compdec')
  @Permissao('municipios.gerenciar')
  @ApiOperation({
    summary: 'Cria ou atualiza os dados da COMPDEC de um município.',
  })
  atualizarCompdec(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtualizarCompdecDto,
    @UsuarioAtual() usuario?: JwtPayload,
  ) {
    return this.service.atualizarCompdec(id, dto, usuario!);
  }

  // ── Regionais ──────────────────────────────────────────────────────────────

  @Get('regionais')
  @Permissao('painel.ver')
  @ApiOperation({ summary: 'Lista regionais (REDECs) com contagem de municípios.' })
  listarRegionais(@Query('ufId') ufId?: string) {
    return this.service.listarRegionais(ufId ? Number(ufId) : undefined);
  }
}
