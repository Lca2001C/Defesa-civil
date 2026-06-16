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
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Express } from 'express';
import { SubmissoesService } from './submissoes.service';
import { CriarSubmissaoDto } from './dto/criar-submissao.dto';
import { AtualizarSubmissaoDto } from './dto/atualizar-submissao.dto';
import { RevisaoDto } from './dto/revisao.dto';
import { Permissao } from '../../common/decorators/permissao.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import type { JwtPayload } from '../../common/types/jwt-payload';
import { FiltroSubmissaoDto } from './dto/filtro-submissao.dto';
import {
  IniciarMultipartDto,
  AssinarParteDto,
  CompletarMultipartDto,
  AbortarMultipartDto,
} from './dto/anexo-multipart.dto';

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
    const ip = (req.headers['x-forwarded-for'] as string) ?? req.ip;
    const ua = req.headers['user-agent'];
    return this.service.criar(dto, usuario, ip, ua);
  }

  @Get()
  @Permissao('submissoes.criar')
  @ApiOperation({ summary: 'Listar submissões (com filtros e paginação)' })
  listar(
    @Query() filtro: FiltroSubmissaoDto,
    @UsuarioAtual() usuario?: JwtPayload,
  ) {
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
      // Caminho legado (modo local/dev): cap em memória para evitar OOM.
      // Anexos grandes (até 50 GB) usam o fluxo multipart direto ao R2.
      limits: { fileSize: 200 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Anexa um arquivo via servidor (modo local/dev). Para arquivos grandes, use o fluxo multipart.' })
  adicionarAnexo(
    @Param('id') id: string,
    @UploadedFile() arquivo: Express.Multer.File,
    @UsuarioAtual() usuario: JwtPayload,
    @Body('perguntaCodigo') perguntaCodigo?: string,
  ) {
    return this.service.adicionarAnexo(id, arquivo, usuario, perguntaCodigo);
  }

  // ── Upload multipart direto ao R2 (anexos grandes, até 50 GB) ──────────────

  @Post(':id/anexos/multipart/iniciar')
  @HttpCode(HttpStatus.OK)
  @Permissao('submissoes.editar')
  @ApiOperation({ summary: 'Inicia um upload multipart (retorna chave/uploadId ou modo local).' })
  iniciarMultipart(
    @Param('id') id: string,
    @Body() dto: IniciarMultipartDto,
    @UsuarioAtual() usuario: JwtPayload,
  ) {
    return this.service.iniciarAnexoMultipart(id, dto, usuario);
  }

  @Post(':id/anexos/multipart/assinar-parte')
  @HttpCode(HttpStatus.OK)
  @Permissao('submissoes.editar')
  @ApiOperation({ summary: 'Retorna a URL assinada (PUT) para enviar uma parte direto ao R2.' })
  assinarParte(
    @Param('id') id: string,
    @Body() dto: AssinarParteDto,
    @UsuarioAtual() usuario: JwtPayload,
  ) {
    return this.service.assinarParteAnexo(id, dto, usuario);
  }

  @Post(':id/anexos/multipart/completar')
  @HttpCode(HttpStatus.CREATED)
  @Permissao('submissoes.editar')
  @ApiOperation({ summary: 'Conclui o upload multipart e registra o anexo.' })
  completarMultipart(
    @Param('id') id: string,
    @Body() dto: CompletarMultipartDto,
    @UsuarioAtual() usuario: JwtPayload,
  ) {
    return this.service.completarAnexoMultipart(id, dto, usuario);
  }

  @Post(':id/anexos/multipart/abortar')
  @HttpCode(HttpStatus.OK)
  @Permissao('submissoes.editar')
  @ApiOperation({ summary: 'Aborta um upload multipart (cancelamento/erro).' })
  abortarMultipart(
    @Param('id') id: string,
    @Body() dto: AbortarMultipartDto,
    @UsuarioAtual() usuario: JwtPayload,
  ) {
    return this.service.abortarAnexoMultipart(id, dto, usuario);
  }

  @Get(':id/anexos/:anexoId/url')
  @Permissao('submissoes.criar')
  @ApiOperation({ summary: 'Retorna a URL assinada de download (GET) do anexo, direto do R2.' })
  urlDownloadAnexo(
    @Param('id') id: string,
    @Param('anexoId') anexoId: string,
    @UsuarioAtual() usuario: JwtPayload,
  ) {
    return this.service.urlDownloadAnexo(id, anexoId, usuario);
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
