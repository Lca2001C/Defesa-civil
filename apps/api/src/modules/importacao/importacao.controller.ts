import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Express } from 'express';
import { ImportacaoService } from './importacao.service';
import { CriarImportacaoDto } from './dto/criar-importacao.dto';
import { Permissao } from '../../common/decorators/permissao.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import type { JwtPayload } from '../../common/types/jwt-payload';

@ApiTags('Importação')
@Controller('importacoes')
export class ImportacaoController {
  constructor(private readonly service: ImportacaoService) {}

  /** Fluxo B — Faz upload de planilha e cria um lote de importação. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissao('importacao.executar')
  @UseInterceptors(FileInterceptor('arquivo'))
  @ApiOperation({ summary: 'Fluxo B — cria lote de importação a partir de planilha' })
  @ApiConsumes('multipart/form-data')
  async criar(
    @Body() dto: CriarImportacaoDto,
    @UploadedFile() arquivo: Express.Multer.File,
    @UsuarioAtual() usuario: JwtPayload,
  ) {
    if (!arquivo) throw new BadRequestException('Campo "arquivo" obrigatório.');
    return this.service.criar(dto, arquivo, usuario);
  }

  @Get()
  @Permissao('importacao.executar')
  listar(@UsuarioAtual() usuario: JwtPayload) {
    return this.service.listar(usuario.sub);
  }

  @Get(':id')
  @Permissao('importacao.executar')
  buscar(@Param('id') id: string) {
    return this.service.buscarPorId(id);
  }
}
