import { Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { SubmissaoStatus } from '@prisma/client';
import { Permissao } from '../../common/decorators/permissao.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import type { JwtPayload } from '../../common/types/jwt-payload';
import { RelatoriosService } from './relatorios.service';
import { StorageService } from '../../infra/storage/storage.service';

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
  @ApiQuery({ name: 'competenciaId', required: false })
  @ApiQuery({ name: 'formularioVersaoId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: SubmissaoStatus })
  @ApiQuery({ name: 'municipioId', required: false, type: Number })
  @ApiQuery({ name: 'regionalId', required: false })
  @ApiQuery({ name: 'busca', required: false })
  @ApiQuery({ name: 'dataInicio', required: false })
  @ApiQuery({ name: 'dataFim', required: false })
  async enfileirar(
    @UsuarioAtual() usuario: JwtPayload,
    @Query('competenciaId') competenciaId?: string,
    @Query('formularioVersaoId') formularioVersaoId?: string,
    @Query('status') status?: SubmissaoStatus,
    @Query('municipioId') municipioId?: string,
    @Query('regionalId') regionalId?: string,
    @Query('busca') busca?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ): Promise<{ jobId: string }> {
    const jobId = await this.service.enfileirarExport(
      {
        competenciaId,
        formularioVersaoId,
        status,
        municipioId: municipioId ? Number(municipioId) : undefined,
        regionalId,
        busca,
        dataInicio,
        dataFim,
      },
      usuario,
    );
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
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${resultado.nome}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
