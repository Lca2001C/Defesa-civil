import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { StorageService } from '../../../infra/storage/storage.service';
import { mascaraCpf } from '../../../shared/utils/format.util';
import { EXPORT_BATCH_SIZE } from '../../../shared/constants';
import type { JwtPayload } from '../../../common/types/jwt-payload';
import type { FiltrosSubmissao } from '../../submissoes/utils/submissoes-where.util';
import { RelatoriosRepository, type LinhaExport } from '../repositories/relatorios.repository';

export const RELATORIOS_QUEUE = 'relatorios';

/** Mesmos filtros da listagem (competenciaId opcional na exportação). */
export type FiltrosExportacao = FiltrosSubmissao;

export interface ExportJobData {
  filtros: FiltrosExportacao;
  solicitanteId: string;
  /** Escopo do solicitante — aplicado ao `where` para não vazar dados fora do escopo. */
  usuario: JwtPayload;
}

export interface ExportJobResultado {
  arquivoId: string;
  chave: string;
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

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Injectable()
export class RelatoriosService {
  private readonly logger = new Logger(RelatoriosService.name);

  constructor(
    private readonly repo: RelatoriosRepository,
    private readonly storage: StorageService,
    @InjectQueue(RELATORIOS_QUEUE) private readonly fila: Queue,
  ) {}

  // ── Enfileiramento e consulta de jobs ──────────────────────────────────────

  /** Enfileira a geração do Excel e retorna o ID do job para acompanhamento. */
  async enfileirarExport(filtros: FiltrosExportacao, usuario: JwtPayload): Promise<string> {
    if (filtros.competenciaId && !(await this.repo.competenciaExiste(filtros.competenciaId))) {
      throw new NotFoundException('Competência não encontrada');
    }

    const job = await this.fila.add(
      'exportar-submissoes',
      { filtros, solicitanteId: usuario.sub, usuario } satisfies ExportJobData,
      { attempts: 2, backoff: { type: 'exponential', delay: 3000 }, removeOnComplete: 50, removeOnFail: 50 },
    );
    return job.id!;
  }

  /** Estado atual de um job de exportação. */
  async consultarJob(jobId: string): Promise<{
    estado: string;
    progresso: number;
    resultado: ExportJobResultado | null;
  }> {
    const job = await this.fila.getJob(jobId);
    if (!job) throw new NotFoundException('Job de exportação não encontrado.');
    const estado = await job.getState();
    const progresso = typeof job.progress === 'number' ? job.progress : 0;
    const resultado = (job.returnvalue as ExportJobResultado | undefined) ?? null;
    return { estado, progresso, resultado };
  }

  // ── Execução do job (chamado pelo processor) ───────────────────────────────

  /** Gera o .xlsx em streaming, salva no storage e devolve o artefato. */
  async executarExport(job: Job<ExportJobData>): Promise<ExportJobResultado> {
    const { filtros, usuario } = job.data;
    const competenciaNome = await this.resolverNomeCompetencia(filtros.competenciaId);
    const tmpPath = path.join(os.tmpdir(), `export-${randomUUID()}.xlsx`);

    try {
      await this.gerarExcelStream(tmpPath, competenciaNome, filtros, usuario, job);

      const nome = `submissoes_${Date.now()}.xlsx`;
      const arquivo = await this.storage.salvarDeCaminho(tmpPath, nome, XLSX_MIME);

      this.logger.log(`[job ${job.id}] Export concluído: arquivo=${arquivo.id} (${arquivo.tamanhoBytes} bytes)`);
      return { arquivoId: arquivo.id, chave: arquivo.chave, nome };
    } finally {
      await fs.promises.rm(tmpPath, { force: true });
    }
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
    job: Job<ExportJobData>,
  ): Promise<void> {
    const total = await this.repo.contar(filtros, usuario);

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: tmpPath });
    workbook.creator = 'Plataforma Defesa Civil MG';

    const sheet = this.criarPlanilhaComCabecalho(workbook);
    await this.preencherLinhas(sheet, filtros, usuario, total, job);
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
    total: number,
    job: Job<ExportJobData>,
  ): Promise<void> {
    let processados = 0;
    let cursor: string | undefined;

    for (;;) {
      const lote = await this.repo.lerLote(filtros, usuario, EXPORT_BATCH_SIZE, cursor);
      if (lote.length === 0) break;

      for (const s of lote) this.escreverLinha(sheet, s);

      processados += lote.length;
      cursor = lote[lote.length - 1]!.id;
      if (total > 0) await job.updateProgress(Math.round((processados / total) * 100));
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
