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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CompetenciaStatus } from '@prisma/client';
import { Permissao } from '../../common/decorators/permissao.decorator';
import { PaginacaoDto } from '../../common/dto/paginacao.dto';
import { CompetenciasService } from './competencias.service';
import { AtualizarCompetenciaDto } from './dto/atualizar-competencia.dto';
import { CriarCompetenciaDto } from './dto/criar-competencia.dto';

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
  @ApiQuery({ name: 'ano', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: CompetenciaStatus })
  buscarTodos(
    @Query() paginacao: PaginacaoDto,
    @Query('ano') ano?: string,
    @Query('status') status?: CompetenciaStatus,
  ) {
    return this.service.buscarTodos(paginacao, {
      ano: ano !== undefined ? Number(ano) : undefined,
      status,
    });
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
