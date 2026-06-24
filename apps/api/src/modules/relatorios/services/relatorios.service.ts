import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { mascaraCpf } from '../../../shared/utils/format.util';
import { EXPORT_BATCH_SIZE } from '../../../shared/constants';
import type { JwtPayload } from '../../../common/types/jwt-payload';
import type { FiltrosSubmissao } from '../../submissoes/utils/submissoes-where.util';
import { RelatoriosRepository, type LinhaExport } from '../repositories/relatorios.repository';

/** Mesmos filtros da listagem (competenciaId opcional na exportação). */
export type FiltrosExportacao = FiltrosSubmissao;

/** Resultado da geração síncrona: caminho temporário do .xlsx e nome de download. */
export interface ExportResultado {
  caminho: string;
  nome: string;
}

/** Índice (base 1) da coluna Status na planilha — usado para aplicar cor de célula. */
const COLUNA_STATUS = 8;

const LABEL_STATUS: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  EM_PREENCHIMENTO: 'Em preenchimento',
  ENVIADO: 'Enviado',
  CORRECAO_SOLICITADA: 'Correção solicitada',
  REVISADO: 'Revisado',
  APROVADO: 'Aprovado',
};

const STATUS_CORES: Record<string, string> = {
  APROVADO: 'FF22C55E',
  CORRECAO_SOLICITADA: 'FFEAB308',
  ENVIADO: 'FF60A5FA',
  REVISADO: 'FF34D399',
  EM_PREENCHIMENTO: 'FFA78BFA',
  RASCUNHO: 'FF94A3B8',
};

const CABECALHOS = [
  { header: 'Protocolo', width: 22 },
  { header: 'Código IBGE', width: 14 },
  { header: 'Município', width: 28 },
  { header: 'Regional (REDEC)', width: 24 },
  { header: 'Competência', width: 24 },
  { header: 'Formulário', width: 28 },
  { header: 'Versão', width: 10 },
  { header: 'Status', width: 22 },
  { header: 'Respondente', width: 30 },
  { header: 'CPF (mascarado)', width: 20 },
  { header: 'Cargo', width: 22 },
  { header: 'E-mail', width: 28 },
  { header: 'Enviado em', width: 20 },
  { header: 'Aprovado em', width: 20 },
];

@Injectable()
export class RelatoriosService {
  private readonly logger = new Logger(RelatoriosService.name);

  constructor(private readonly repo: RelatoriosRepository) {}

  // ── Geração síncrona do Excel ──────────────────────────────────────────────

  /**
   * Gera o .xlsx em streaming para um arquivo temporário e devolve o caminho +
   * nome de download. O controller faz o stream do arquivo na resposta e apaga
   * o temporário ao final. Sem fila: execução síncrona na própria request.
   */
  async gerarExport(filtros: FiltrosExportacao, usuario: JwtPayload): Promise<ExportResultado> {
    if (filtros.competenciaId && !(await this.repo.competenciaExiste(filtros.competenciaId))) {
      throw new NotFoundException('Competência não encontrada');
    }

    const competenciaNome = await this.resolverNomeCompetencia(filtros.competenciaId);
    const caminho = path.join(os.tmpdir(), `export-${randomUUID()}.xlsx`);

    try {
      await this.gerarExcelStream(caminho, competenciaNome, filtros, usuario);
    } catch (e) {
      // Remove o .xlsx parcial para não acumular lixo no /tmp da VM.
      await fs.promises.rm(caminho, { force: true }).catch(() => undefined);
      throw e;
    }

    const nome = `submissoes_${new Date().toISOString().slice(0, 10)}.xlsx`;
    this.logger.log(`Export gerado: ${caminho} (nome=${nome})`);
    return { caminho, nome };
  }

  private async resolverNomeCompetencia(competenciaId?: string): Promise<string> {
    if (!competenciaId) return 'Todas as competências';
    const nome = await this.repo.competenciaNome(competenciaId);
    if (!nome) throw new NotFoundException('Competência não encontrada');
    return nome;
  }

  // ── Geração do Excel (decomposta) ──────────────────────────────────────────

  private async gerarExcelStream(
    tmpPath: string,
    competenciaNome: string,
    filtros: FiltrosExportacao,
    usuario: JwtPayload,
  ): Promise<void> {
    const total = await this.repo.contar(filtros, usuario);

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: tmpPath });
    workbook.creator = 'Plataforma Defesa Civil MG';

    const sheet = this.criarPlanilhaComCabecalho(workbook);
    await this.preencherLinhas(sheet, filtros, usuario);
    sheet.commit();

    await this.adicionarResumo(workbook, competenciaNome, filtros, usuario, total);
    await workbook.commit();
  }

  private criarPlanilhaComCabecalho(
    workbook: ExcelJS.stream.xlsx.WorkbookWriter,
  ): ExcelJS.Worksheet {
    const sheet = workbook.addWorksheet('Submissões');
    sheet.columns = CABECALHOS.map((c, i) => ({ header: c.header, key: `col${i}`, width: c.width }));

    const linhaHeader = sheet.getRow(1);
    linhaHeader.values = CABECALHOS.map((c) => c.header);
    linhaHeader.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    linhaHeader.commit();
    return sheet;
  }

  private async preencherLinhas(
    sheet: ExcelJS.Worksheet,
    filtros: FiltrosExportacao,
    usuario: JwtPayload,
  ): Promise<void> {
    let cursor: string | undefined;

    for (;;) {
      const lote = await this.repo.lerLote(filtros, usuario, EXPORT_BATCH_SIZE, cursor);
      if (lote.length === 0) break;

      for (const s of lote) this.escreverLinha(sheet, s);

      cursor = lote[lote.length - 1]!.id;
      if (lote.length < EXPORT_BATCH_SIZE) break;
    }
  }

  private escreverLinha(sheet: ExcelJS.Worksheet, s: LinhaExport): void {
    const linha = sheet.addRow([
      s.protocolo ?? '—',
      s.municipioId,
      s.municipioNome,
      s.regionalNome ?? '—',
      s.competenciaNome,
      s.formularioNome,
      `v${s.versao}`,
      LABEL_STATUS[s.status] ?? s.status,
      s.nomeRespondente,
      mascaraCpf(s.cpfRespondente),
      s.cargoRespondente ?? '—',
      s.emailRespondente ?? '—',
      s.enviadoEm ? s.enviadoEm.toLocaleString('pt-BR') : '—',
      s.aprovadoEm ? s.aprovadoEm.toLocaleString('pt-BR') : '—',
    ]);
    const celulaStatus = linha.getCell(COLUNA_STATUS);
    celulaStatus.font = { bold: true, color: { argb: STATUS_CORES[s.status] ?? 'FF94A3B8' } };
    linha.getCell(1).font = { name: 'Courier New', size: 10 };
    linha.commit();
  }

  private async adicionarResumo(
    workbook: ExcelJS.stream.xlsx.WorkbookWriter,
    competenciaNome: string,
    filtros: FiltrosExportacao,
    usuario: JwtPayload,
    total: number,
  ): Promise<void> {
    const porStatus = await this.repo.agruparPorStatus(filtros, usuario);
    const contagem = new Map(porStatus.map((g) => [g.status as string, g.total]));
    const aprovadas = contagem.get('APROVADO') ?? 0;
    const pendentes =
      total - aprovadas - (contagem.get('RASCUNHO') ?? 0) - (contagem.get('EM_PREENCHIMENTO') ?? 0);

    const abaResumo = workbook.addWorksheet('Resumo');
    abaResumo.addRow(['Competência', competenciaNome]).commit();
    abaResumo.addRow(['Total exportado', total]).commit();
    abaResumo.addRow(['Aprovadas', aprovadas]).commit();
    abaResumo.addRow(['Pendentes', pendentes]).commit();
    abaResumo.addRow(['Data de exportação', new Date().toLocaleString('pt-BR')]).commit();
    abaResumo.commit();
  }
}
