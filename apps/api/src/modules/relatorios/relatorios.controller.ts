import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { SubmissaoStatus } from '@prisma/client';
import { Permissao } from '../../common/decorators/permissao.decorator';
import { RelatoriosService } from './relatorios.service';

@ApiBearerAuth()
@ApiTags('relatorios')
@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly service: RelatoriosService) {}

  @Get('submissoes/export')
  @Permissao('relatorios.exportar')
  @ApiOperation({ summary: 'Exporta submissões em Excel (.xlsx) com protocolo.' })
  @ApiQuery({ name: 'competenciaId', required: true })
  @ApiQuery({ name: 'status', required: false, enum: SubmissaoStatus })
  @ApiQuery({ name: 'municipioId', required: false, type: Number })
  @ApiQuery({ name: 'regionalId', required: false })
  async exportar(
    @Query('competenciaId') competenciaId: string,
    @Query('status') status?: SubmissaoStatus,
    @Query('municipioId') municipioId?: string,
    @Query('regionalId') regionalId?: string,
    @Res() res?: Response,
  ) {
    const buffer = await this.service.exportarSubmissoes({
      competenciaId,
      status,
      municipioId: municipioId ? Number(municipioId) : undefined,
      regionalId,
    });

    const nome = `submissoes_${competenciaId}_${Date.now()}.xlsx`;
    res!.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nome}"`,
      'Content-Length': buffer.length,
    });
    res!.end(buffer);
  }
}
