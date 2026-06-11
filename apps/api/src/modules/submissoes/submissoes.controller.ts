import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SubmissaoStatus } from '@prisma/client';
import { SubmissoesService } from './submissoes.service';
import { CriarSubmissaoDto } from './dto/criar-submissao.dto';
import { AtualizarSubmissaoDto } from './dto/atualizar-submissao.dto';
import { RevisaoDto } from './dto/revisao.dto';
import { Permissao } from '../../common/decorators/permissao.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import type { JwtPayload } from '../../common/types/jwt-payload';
import { PaginacaoDto } from '../../common/dto/paginacao.dto';

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
    @Query() paginacao: PaginacaoDto,
    @Query('competenciaId') competenciaId?: string,
    @Query('formularioVersaoId') formularioVersaoId?: string,
    @Query('municipioId') municipioId?: string,
    @Query('status') status?: string,
    @UsuarioAtual() usuario?: JwtPayload,
  ) {
    return this.service.listar(
      paginacao,
      {
        competenciaId,
        formularioVersaoId,
        municipioId: municipioId ? parseInt(municipioId, 10) : undefined,
        status: status as SubmissaoStatus | undefined,
      },
      usuario!,
    );
  }

  @Get(':id')
  @Permissao('submissoes.criar')
  @ApiOperation({ summary: 'Buscar submissão por ID' })
  buscar(@Param('id') id: string, @UsuarioAtual() usuario: JwtPayload) {
    return this.service.buscarPorId(id, usuario);
  }

  @Patch(':id')
  @Permissao('submissoes.editar')
  @ApiOperation({ summary: 'Atualizar dados de um rascunho ou submissão em correção' })
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
  @ApiOperation({ summary: 'Enviar rascunho → ENVIADA (gera protocolo)' })
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
  @ApiOperation({ summary: 'Reenviar submissão corrigida → REVISADA' })
  revisar(
    @Param('id') id: string,
    @Body() dto: RevisaoDto,
    @UsuarioAtual() usuario: JwtPayload,
  ) {
    return this.service.revisar(id, dto, usuario);
  }

  @Patch(':id/validar')
  @HttpCode(HttpStatus.OK)
  @Permissao('submissoes.validar')
  @ApiOperation({ summary: 'Validar submissão → VALIDADA' })
  validar(
    @Param('id') id: string,
    @Body() dto: RevisaoDto,
    @UsuarioAtual() usuario: JwtPayload,
  ) {
    return this.service.validar(id, dto, usuario);
  }

  @Patch(':id/rejeitar')
  @HttpCode(HttpStatus.OK)
  @Permissao('submissoes.validar')
  @ApiOperation({ summary: 'Rejeitar submissão → REJEITADA' })
  rejeitar(
    @Param('id') id: string,
    @Body() dto: RevisaoDto,
    @UsuarioAtual() usuario: JwtPayload,
  ) {
    return this.service.rejeitar(id, dto, usuario);
  }
}
