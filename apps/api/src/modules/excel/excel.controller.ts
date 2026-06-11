import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Express } from 'express';
import { ExcelParserService } from './excel-parser.service';
import { Permissao } from '../../common/decorators/permissao.decorator';

@ApiTags('Excel')
@Controller('excel')
export class ExcelController {
  constructor(private readonly parser: ExcelParserService) {}

  /**
   * Fluxo A — Recebe um .xlsx e devolve um SchemaFormulario (rascunho).
   * O admin pode ajustar o schema antes de publicar.
   */
  @Post('parse-template')
  @HttpCode(HttpStatus.OK)
  @Permissao('formularios.criar')
  @UseInterceptors(FileInterceptor('arquivo'))
  @ApiOperation({ summary: 'Fluxo A — planilha → SchemaFormulario (rascunho)' })
  @ApiConsumes('multipart/form-data')
  async parsearTemplate(
    @UploadedFile() arquivo: Express.Multer.File,
  ) {
    if (!arquivo) {
      throw new BadRequestException('Campo "arquivo" obrigatório.');
    }
    const mime = arquivo.mimetype;
    const isXlsx =
      mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mime === 'application/vnd.ms-excel' ||
      arquivo.originalname.endsWith('.xlsx') ||
      arquivo.originalname.endsWith('.xls');

    if (!isXlsx) {
      throw new BadRequestException('Envie um arquivo .xlsx ou .xls.');
    }

    const schema = await this.parser.parsearTemplate(
      arquivo.buffer,
      arquivo.originalname.replace(/\.[^.]+$/, ''),
    );
    return schema;
  }
}
