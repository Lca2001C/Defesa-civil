import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FormularioStatus } from '@prisma/client';
import { Permissao } from '../../common/decorators/permissao.decorator';
import { PaginacaoDto } from '../../common/dto/paginacao.dto';
import { AtualizarFormularioDto } from './dto/atualizar-formulario.dto';
import { CriarFormularioDto } from './dto/criar-formulario.dto';
import { CriarVersaoDto } from './dto/criar-versao.dto';
import { PublicarVersaoDto } from './dto/publicar-versao.dto';
import { FormulariosService } from './formularios.service';

@ApiBearerAuth()
@ApiTags('formularios')
@Controller('formularios')
export class FormulariosController {
  constructor(private readonly service: FormulariosService) {}

  @Post()
  @Permissao('formularios.criar')
  @ApiOperation({ summary: 'Cria um novo formulário (metadados).' })
  criar(@Body() dto: CriarFormularioDto) {
    return this.service.criar(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista formulários com paginação.' })
  @ApiQuery({ name: 'status', required: false, enum: FormularioStatus })
  buscarTodos(
    @Query() paginacao: PaginacaoDto,
    @Query('status') status?: FormularioStatus,
  ) {
    return this.service.buscarTodos(paginacao, { status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retorna um formulário com todas as suas versões.' })
  buscarPorId(@Param('id') id: string) {
    return this.service.buscarPorId(id);
  }

  @Patch(':id')
  @Permissao('formularios.criar')
  @ApiOperation({ summary: 'Atualiza metadados do formulário.' })
  atualizar(@Param('id') id: string, @Body() dto: AtualizarFormularioDto) {
    return this.service.atualizar(id, dto);
  }

  @Post(':id/versoes')
  @Permissao('formularios.criar')
  @ApiOperation({ summary: 'Cria uma nova versão (rascunho) do formulário com o schema JSONB.' })
  criarVersao(@Param('id') id: string, @Body() dto: CriarVersaoDto) {
    return this.service.criarVersao(id, dto);
  }

  @Get(':id/versoes/:versaoId')
  @ApiOperation({ summary: 'Retorna o schema completo de uma versão específica.' })
  buscarVersao(@Param('id') id: string, @Param('versaoId') versaoId: string) {
    return this.service.buscarVersao(id, versaoId);
  }

  @Patch(':id/versoes/:versaoId/publicar')
  @Permissao('formularios.publicar')
  @ApiOperation({
    summary: 'Publica uma versão vinculando-a a uma competência ABERTA.',
  })
  publicarVersao(
    @Param('id') id: string,
    @Param('versaoId') versaoId: string,
    @Body() dto: PublicarVersaoDto,
  ) {
    return this.service.publicarVersao(id, versaoId, dto);
  }
}
