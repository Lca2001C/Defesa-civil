import { Controller, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import * as fs from 'fs';
import { Permissao } from '../../../common/decorators/permissao.decorator';
import { UsuarioAtual } from '../../../common/decorators/usuario-atual.decorator';
import type { JwtPayload } from '../../../common/types/jwt-payload';
import { RelatoriosService } from '../services/relatorios.service';
import { FiltrosExportacaoDto } from '../dtos/filtros-exportacao.dto';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiBearerAuth()
@ApiTags('relatorios')
@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly service: RelatoriosService) {}

  @Post('submissoes/export')
  @Permissao('relatorios.exportar')
  @ApiOperation({
    summary: 'Exporta submissões em Excel (geração síncrona, download direto).',
  })
  async exportar(
    @UsuarioAtual() usuario: JwtPayload,
    @Query() filtros: FiltrosExportacaoDto,
    @Res() res: Response,
  ): Promise<void> {
    const { caminho, nome } = await this.service.gerarExport(filtros, usuario);

    res.set({
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="${nome}"`,
    });

    const stream = fs.createReadStream(caminho);
    // Remove o arquivo temporário ao terminar o envio (sucesso ou erro).
    const limpar = () => fs.promises.rm(caminho, { force: true }).catch(() => undefined);
    stream.on('end', limpar);
    stream.on('error', limpar);
    res.on('close', limpar);
    stream.pipe(res);
  }
}
