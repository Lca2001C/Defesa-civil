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
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request, Response, Express } from 'express';
import { FormularioStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { Permissao } from '../../../common/decorators/permissao.decorator';
import { NivelMinimo } from '../../../common/decorators/nivel-minimo.decorator';
import { UsuarioAtual } from '../../../common/decorators/usuario-atual.decorator';
import { extrairIp } from '../../../shared/utils/format.util';
import type { JwtPayload } from '../../../common/types/jwt-payload';
import { PERMISSION_LEVEL } from '../../../shared/constants';
import { PaginacaoDto } from '../../../common/dto/paginacao.dto';
import { AtualizarFormularioDto } from '../dtos/atualizar-formulario.dto';
import { CriarFormularioDto } from '../dtos/criar-formulario.dto';
import { CriarVersaoDto } from '../dtos/criar-versao.dto';
import { PublicarVersaoDto } from '../dtos/publicar-versao.dto';
import { FormulariosService } from '../services/formularios.service';

/** Limite do upload da planilha (.xlsx é pequeno; evita abuso do parser). */
const MAX_XLSX_BYTES = 5 * 1024 * 1024;

@ApiBearerAuth()
@ApiTags('formularios')
@Controller('formularios')
export class FormulariosController {
  constructor(private readonly service: FormulariosService) {}

  @Post()
  @NivelMinimo(PERMISSION_LEVEL.GESTOR_ESTADUAL)
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
  @NivelMinimo(PERMISSION_LEVEL.GESTOR_ESTADUAL)
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

  // ── Importação via Excel (planilha-modelo do sistema) ──────────────────────

  @Get('modelo-importacao')
  @NivelMinimo(PERMISSION_LEVEL.GESTOR_ESTADUAL)
  @Permissao('formularios.criar')
  @ApiOperation({ summary: 'Baixa a planilha-modelo (.xlsx) para importar um formulário.' })
  async baixarModeloImportacao(@Res() res: Response) {
    const buffer = await this.service.gerarModeloImportacao();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="modelo-formulario-compdec.xlsx"',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /** Valida a extensão .xlsx e devolve o arquivo (erros amigáveis). */
  private exigirXlsx(arquivo: Express.Multer.File): Express.Multer.File {
    if (!arquivo) throw new BadRequestException('Envie a planilha no campo "arquivo".');
    if (!/\.xlsx$/i.test(arquivo.originalname)) {
      throw new BadRequestException(
        'O arquivo deve ser .xlsx. Se o seu é .xls (Excel antigo), abra no Excel e use "Salvar como" .xlsx.',
      );
    }
    return arquivo;
  }

  @Post('importar-excel/preview')
  @NivelMinimo(PERMISSION_LEVEL.GESTOR_ESTADUAL)
  @Permissao('formularios.criar')
  @UseInterceptors(
    FileInterceptor('arquivo', { storage: memoryStorage(), limits: { fileSize: MAX_XLSX_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Prévia da importação (não persiste): resumo + erros amigáveis.' })
  previaImportacao(@UploadedFile() arquivo: Express.Multer.File) {
    return this.service.previaImportacao(this.exigirXlsx(arquivo).buffer);
  }

  @Post('importar-excel')
  @NivelMinimo(PERMISSION_LEVEL.GESTOR_ESTADUAL)
  @Permissao('formularios.criar')
  @UseInterceptors(
    FileInterceptor('arquivo', { storage: memoryStorage(), limits: { fileSize: MAX_XLSX_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Cria um formulário NATIVO (rascunho) a partir de uma planilha Excel.' })
  importarExcel(
    @UploadedFile() arquivo: Express.Multer.File,
    @UsuarioAtual() usuario: JwtPayload,
    @Req() req: Request,
  ) {
    const file = this.exigirXlsx(arquivo);
    return this.service.importarExcel(file.buffer, {
      atorId: usuario.sub,
      ip: extrairIp(req),
      userAgent: req.headers['user-agent'],
      nomeArquivo: file.originalname,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retorna um formulário e o resumo de suas versões.' })
  buscarPorId(@Param('id') id: string) {
    return this.service.buscarPorId(id);
  }

  @Delete(':id')
  @NivelMinimo(PERMISSION_LEVEL.GESTOR_ESTADUAL)
  @Permissao('formularios.criar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclui um formulário e todas as suas versões (bloqueado se houver submissões).' })
  excluir(@Param('id') id: string) {
    return this.service.excluir(id);
  }

  @Patch(':id')
  @NivelMinimo(PERMISSION_LEVEL.GESTOR_ESTADUAL)
  @Permissao('formularios.criar')
  @ApiOperation({ summary: 'Atualiza metadados do formulário.' })
  atualizar(@Param('id') id: string, @Body() dto: AtualizarFormularioDto) {
    return this.service.atualizar(id, dto);
  }

  @Post(':id/versoes')
  @NivelMinimo(PERMISSION_LEVEL.GESTOR_ESTADUAL)
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
  @NivelMinimo(PERMISSION_LEVEL.GESTOR_ESTADUAL)
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
  @NivelMinimo(PERMISSION_LEVEL.GESTOR_ESTADUAL)
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
