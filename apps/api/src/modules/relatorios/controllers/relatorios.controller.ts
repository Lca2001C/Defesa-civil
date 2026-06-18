import { Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Permissao } from '../../../common/decorators/permissao.decorator';
import { UsuarioAtual } from '../../../common/decorators/usuario-atual.decorator';
import type { JwtPayload } from '../../../common/types/jwt-payload';
import { StorageService } from '../../../infra/storage/storage.service';
import { RelatoriosService } from '../services/relatorios.service';
import { FiltrosExportacaoDto } from '../dto/filtros-exportacao.dto';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiBearerAuth()
@ApiTags('relatorios')
@Controller('relatorios')
export class RelatoriosController {
  constructor(
    private readonly service: RelatoriosService,
    private readonly storage: StorageService,
  ) {}

  @Post('submissoes/export')
  @Permissao('relatorios.exportar')
  @ApiOperation({ summary: 'Enfileira a exportação de submissões em Excel (job assíncrono).' })
  async enfileirar(
    @UsuarioAtual() usuario: JwtPayload,
    @Query() filtros: FiltrosExportacaoDto,
  ): Promise<{ jobId: string }> {
    const jobId = await this.service.enfileirarExport(filtros, usuario);
    return { jobId };
  }

  @Get('export/:jobId')
  @Permissao('relatorios.exportar')
  @ApiOperation({ summary: 'Consulta o estado de um job de exportação.' })
  consultar(@Param('jobId') jobId: string) {
    return this.service.consultarJob(jobId);
  }

  @Get('export/:jobId/download')
  @Permissao('relatorios.exportar')
  @ApiOperation({ summary: 'Faz o download do Excel gerado por um job concluído.' })
  async download(@Param('jobId') jobId: string, @Res() res: Response) {
    const { estado, resultado } = await this.service.consultarJob(jobId);
    if (estado !== 'completed' || !resultado) {
      res.status(409).json({ message: `Export ainda não disponível (estado: ${estado}).` });
      return;
    }

    const buffer = await this.storage.ler(resultado.chave);
    res.set({
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="${resultado.nome}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
