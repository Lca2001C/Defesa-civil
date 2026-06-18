import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FormularioStatus } from '@prisma/client';
import { Permissao } from '../../../common/decorators/permissao.decorator';
import { PaginacaoDto } from '../../../common/dto/paginacao.dto';
import { AtualizarFormularioDto } from '../dto/atualizar-formulario.dto';
import { CriarFormularioDto } from '../dto/criar-formulario.dto';
import { CriarVersaoDto } from '../dto/criar-versao.dto';
import { PublicarVersaoDto } from '../dto/publicar-versao.dto';
import { FormulariosService } from '../services/formularios.service';

@ApiBearerAuth()
@ApiTags('formularios')
@Controller('formularios')
export class FormulariosController {
  constructor(private readonly service: FormulariosService) {}

  @Post()
  @Permissao('formularios.criar')
  @ApiOperation({ summary: 'Cria um novo formulário (metadados + schema opcional na v1).' })
  criar(@Body() dto: CriarFormularioDto) {
    return this.service.criar(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista formulários com paginação.' })
  @ApiQuery({ name: 'status', required: false, enum: FormularioStatus })
  buscarTodos(@Query() paginacao: PaginacaoDto, @Query('status') status?: FormularioStatus) {
    return this.service.buscarTodos(paginacao, { status });
  }

  /** Versões publicadas de todos os formulários — usado no wizard de submissão. */
  @Get('versoes/publicadas')
  @ApiOperation({ summary: 'Lista todas as versões publicadas (para selects).' })
  versaoPublicadas() {
    return this.service.listarVersoesPublicadas();
  }

  @Get('templates')
  @ApiOperation({ summary: 'Lista os templates de formulário disponíveis.' })
  listarTemplates() {
    return this.service.listarTemplates();
  }

  @Post('from-template/:templateId')
  @Permissao('formularios.criar')
  @ApiOperation({ summary: 'Cria um formulário (rascunho) a partir de um template.' })
  criarDeTemplate(@Param('templateId') templateId: string) {
    return this.service.criarDeTemplate(templateId);
  }

  @Get('blocos')
  @ApiOperation({ summary: 'Lista os blocos reutilizáveis (para o construtor).' })
  listarBlocos() {
    return this.service.listarBlocos();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retorna um formulário e o resumo de suas versões.' })
  buscarPorId(@Param('id') id: string) {
    return this.service.buscarPorId(id);
  }

  @Delete(':id')
  @Permissao('formularios.criar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclui um formulário e todas as suas versões (bloqueado se houver submissões).' })
  excluir(@Param('id') id: string) {
    return this.service.excluir(id);
  }

  @Patch(':id')
  @Permissao('formularios.criar')
  @ApiOperation({ summary: 'Atualiza metadados do formulário.' })
  atualizar(@Param('id') id: string, @Body() dto: AtualizarFormularioDto) {
    return this.service.atualizar(id, dto);
  }

  @Post(':id/versoes')
  @Permissao('formularios.criar')
  @ApiOperation({ summary: 'Cria uma nova versão (rascunho) a partir de um schema.' })
  criarVersao(@Param('id') id: string, @Body() dto: CriarVersaoDto) {
    return this.service.criarVersao(id, dto);
  }

  @Get(':id/versoes/:versaoId')
  @ApiOperation({ summary: 'Retorna o schema COMPOSTO de uma versão.' })
  buscarVersao(@Param('id') id: string, @Param('versaoId') versaoId: string) {
    return this.service.buscarVersao(id, versaoId);
  }

  @Put(':id/versoes/:versaoId')
  @Permissao('formularios.criar')
  @ApiOperation({
    summary: 'Salva o schema editado na versão (cria nova versão se publicada com submissões).',
  })
  salvarVersao(
    @Param('id') id: string,
    @Param('versaoId') versaoId: string,
    @Body() dto: CriarVersaoDto,
  ) {
    return this.service.salvarVersao(id, versaoId, dto);
  }

  @Patch(':id/versoes/:versaoId/publicar')
  @Permissao('formularios.publicar')
  @ApiOperation({ summary: 'Publica uma versão vinculando-a a uma competência ABERTA.' })
  publicarVersao(
    @Param('id') id: string,
    @Param('versaoId') versaoId: string,
    @Body() dto: PublicarVersaoDto,
  ) {
    return this.service.publicarVersao(id, versaoId, dto);
  }
}
