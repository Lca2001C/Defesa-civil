import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissao } from '../../../common/decorators/permissao.decorator';
import { CompetenciasService } from '../services/competencias.service';
import { AtualizarCompetenciaDto } from '../dto/atualizar-competencia.dto';
import { CriarCompetenciaDto } from '../dto/criar-competencia.dto';
import { FiltrosCompetenciaDto } from '../dto/filtros-competencia.dto';

@ApiBearerAuth()
@ApiTags('competencias')
@Controller('competencias')
export class CompetenciasController {
  constructor(private readonly service: CompetenciasService) {}

  @Post()
  @Permissao('competencias.gerenciar')
  @ApiOperation({ summary: 'Cria uma nova competência (ciclo de coleta).' })
  criar(@Body() dto: CriarCompetenciaDto) {
    return this.service.criar(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista competências com paginação e filtros.' })
  buscarTodos(@Query() filtros: FiltrosCompetenciaDto) {
    const { pagina, porPagina, ano, status } = filtros;
    return this.service.buscarTodos({ pagina, porPagina }, { ano, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retorna uma competência pelo ID.' })
  buscarPorId(@Param('id') id: string) {
    return this.service.buscarPorId(id);
  }

  @Patch(':id')
  @Permissao('competencias.gerenciar')
  @ApiOperation({ summary: 'Atualiza nome, datas ou ano da competência.' })
  atualizar(@Param('id') id: string, @Body() dto: AtualizarCompetenciaDto) {
    return this.service.atualizar(id, dto);
  }

  @Patch(':id/abrir')
  @Permissao('competencias.gerenciar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transiciona a competência de PLANEJADA → ABERTA.' })
  abrir(@Param('id') id: string) {
    return this.service.abrir(id);
  }

  @Patch(':id/encerrar')
  @Permissao('competencias.gerenciar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transiciona a competência de ABERTA → ENCERRADA.' })
  encerrar(@Param('id') id: string) {
    return this.service.encerrar(id);
  }
}
