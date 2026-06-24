import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request, Response, Express } from 'express';
import { SubmissoesService } from '../services/submissoes.service';
import { CriarSubmissaoDto } from '../dtos/criar-submissao.dto';
import { AtualizarSubmissaoDto } from '../dtos/atualizar-submissao.dto';
import { RevisaoDto } from '../dtos/revisao.dto';
import { Permissao } from '../../../common/decorators/permissao.decorator';
import { UsuarioAtual } from '../../../common/decorators/usuario-atual.decorator';
import { extrairIp } from '../../../shared/utils/format.util';
import { MAX_LEGACY_UPLOAD_BYTES } from '../../../shared/constants';
import type { JwtPayload } from '../../../common/types/jwt-payload';
import { FiltroSubmissaoDto } from '../dtos/filtro-submissao.dto';
import { IniciarAnexoDto, CompletarAnexoDto } from '../dtos/anexo-multipart.dto';

@ApiTags('Submissões')
@Controller('submissoes')
export class SubmissoesController {
  constructor(private readonly service: SubmissoesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissao('submissoes.criar')
  @ApiOperation({ summary: 'Criar submissão (rascunho ou enviada)' })
  criar(
    @Body() dto: CriarSubmissaoDto,
    @UsuarioAtual() usuario: JwtPayload,
    @Req() req: Request,
  ) {
    return this.service.criar(dto, usuario, extrairIp(req), req.headers['user-agent']);
  }

  @Get()
  @Permissao('submissoes.criar')
  @ApiOperation({ summary: 'Listar submissões (com filtros e paginação)' })
  listar(@Query() filtro: FiltroSubmissaoDto, @UsuarioAtual() usuario?: JwtPayload) {
    const {
      pagina,
      porPagina,
      competenciaId,
      formularioVersaoId,
      municipioId,
      regionalId,
      status,
      busca,
      dataInicio,
      dataFim,
    } = filtro;
    return this.service.listar(
      { pagina, porPagina },
      {
        competenciaId,
        formularioVersaoId,
        municipioId: municipioId ? parseInt(municipioId, 10) : undefined,
        regionalId,
        status,
        busca,
        dataInicio,
        dataFim,
      },
      usuario!,
    );
  }

  @Get(':id')
  @Permissao('submissoes.criar')
  @ApiOperation({ summary: 'Buscar submissão por ID (com schema composto, dados e anexos)' })
  buscar(@Param('id') id: string, @UsuarioAtual() usuario: JwtPayload) {
    return this.service.buscarPorId(id, usuario);
  }

  @Get(':id/export')
  @Permissao('submissoes.criar')
  @ApiQuery({ name: 'formato', required: false, enum: ['pdf', 'xlsx'] })
  @ApiOperation({ summary: 'Baixa a submissão como documento (PDF ou Excel).' })
  async exportar(
    @Param('id') id: string,
    @UsuarioAtual() usuario: JwtPayload,
    @Res() res: Response,
    @Req() req: Request,
    @Query('formato') formato: 'pdf' | 'xlsx' = 'pdf',
  ) {
    const { buffer, filename, mimeType } = await this.service.exportar(id, formato, usuario, {
      ip: extrairIp(req),
      userAgent: req.headers['user-agent'],
    });
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissao('submissoes.criar')
  @ApiOperation({ summary: 'Exclui uma submissão (RASCUNHO/EM_PREENCHIMENTO para usuários comuns; qualquer status para admins)' })
  excluir(@Param('id') id: string, @UsuarioAtual() usuario: JwtPayload) {
    return this.service.excluir(id, usuario);
  }

  @Patch(':id')
  @Permissao('submissoes.editar')
  @ApiOperation({ summary: 'Atualizar respostas de um rascunho ou submissão em correção' })
  atualizar(
    @Param('id') id: string,
    @Body() dto: AtualizarSubmissaoDto,
    @UsuarioAtual() usuario: JwtPayload,
  ) {
    return this.service.atualizar(id, dto, usuario);
  }

  @Patch(':id/enviar')
  @HttpCode(HttpStatus.OK)
  @Permissao('submissoes.criar')
  @ApiOperation({ summary: 'Enviar → ENVIADO (gera protocolo)' })
  enviar(@Param('id') id: string, @UsuarioAtual() usuario: JwtPayload) {
    return this.service.enviar(id, usuario);
  }

  @Patch(':id/solicitar-correcao')
  @HttpCode(HttpStatus.OK)
  @Permissao('submissoes.revisar')
  @ApiOperation({ summary: 'Solicitar correção → CORRECAO_SOLICITADA' })
  solicitarCorrecao(
    @Param('id') id: string,
    @Body() dto: RevisaoDto,
    @UsuarioAtual() usuario: JwtPayload,
  ) {
    return this.service.solicitarCorrecao(id, dto, usuario);
  }

  @Patch(':id/revisar')
  @HttpCode(HttpStatus.OK)
  @Permissao('submissoes.editar')
  @ApiOperation({ summary: 'Reenviar submissão corrigida → REVISADO' })
  revisar(
    @Param('id') id: string,
    @Body() dto: RevisaoDto,
    @UsuarioAtual() usuario: JwtPayload,
  ) {
    return this.service.revisar(id, dto, usuario);
  }

  @Patch(':id/aprovar')
  @HttpCode(HttpStatus.OK)
  @Permissao('submissoes.validar')
  @ApiOperation({ summary: 'Aprovar submissão → APROVADO' })
  aprovar(
    @Param('id') id: string,
    @Body() dto: RevisaoDto,
    @UsuarioAtual() usuario: JwtPayload,
  ) {
    return this.service.aprovar(id, dto, usuario);
  }

  // ----------------------------------------------------------------- anexos --

  @Get(':id/anexos')
  @Permissao('submissoes.criar')
  @ApiOperation({ summary: 'Lista os anexos de uma submissão' })
  listarAnexos(@Param('id') id: string, @UsuarioAtual() usuario: JwtPayload) {
    return this.service.listarAnexos(id, usuario);
  }

  @Post(':id/anexos')
  @HttpCode(HttpStatus.CREATED)
  @Permissao('submissoes.editar')
  @UseInterceptors(
    FileInterceptor('arquivo', {
      storage: memoryStorage(),
      // Caminho local/dev: cap em memória para evitar OOM. Em produção (Azure)
      // o upload vai direto ao Blob via SAS (endpoints /anexos/iniciar+completar).
      limits: { fileSize: MAX_LEGACY_UPLOAD_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Anexa um arquivo via servidor (modo local/dev). Em produção, use /anexos/iniciar + Blob SAS.' })
  adicionarAnexo(
    @Param('id') id: string,
    @UploadedFile() arquivo: Express.Multer.File,
    @UsuarioAtual() usuario: JwtPayload,
    @Body('perguntaCodigo') perguntaCodigo?: string,
  ) {
    return this.service.adicionarAnexo(id, arquivo, usuario, perguntaCodigo);
  }

  // ── Upload direto ao Azure Blob (SAS, PUT único) ───────────────────────────

  @Post(':id/anexos/iniciar')
  @HttpCode(HttpStatus.OK)
  @Permissao('submissoes.editar')
  @ApiOperation({ summary: 'Inicia o upload de anexo (retorna URL SAS de escrita + chave, ou modo local).' })
  iniciarAnexo(
    @Param('id') id: string,
    @Body() dto: IniciarAnexoDto,
    @UsuarioAtual() usuario: JwtPayload,
  ) {
    return this.service.iniciarAnexo(id, dto, usuario);
  }

  @Post(':id/anexos/completar')
  @HttpCode(HttpStatus.CREATED)
  @Permissao('submissoes.editar')
  @ApiOperation({ summary: 'Conclui o upload (após o PUT no Blob) e registra o anexo.' })
  completarAnexo(
    @Param('id') id: string,
    @Body() dto: CompletarAnexoDto,
    @UsuarioAtual() usuario: JwtPayload,
  ) {
    return this.service.completarAnexo(id, dto, usuario);
  }

  @Get(':id/anexos/:anexoId/url')
  @Permissao('submissoes.criar')
  @ApiOperation({ summary: 'Retorna a URL SAS de download do anexo, direto do Blob.' })
  urlDownloadAnexo(
    @Param('id') id: string,
    @Param('anexoId') anexoId: string,
    @UsuarioAtual() usuario: JwtPayload,
    @Req() req: Request,
  ) {
    return this.service.urlDownloadAnexo(id, anexoId, usuario, {
      ip: extrairIp(req),
      userAgent: req.headers['user-agent'],
    });
  }

  @Delete(':id/anexos/:anexoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissao('submissoes.editar')
  @ApiOperation({ summary: 'Remove um anexo da submissão' })
  removerAnexo(
    @Param('id') id: string,
    @Param('anexoId') anexoId: string,
    @UsuarioAtual() usuario: JwtPayload,
  ) {
    return this.service.removerAnexo(id, anexoId, usuario);
  }
}
