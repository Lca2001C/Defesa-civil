import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { Prisma, SubmissaoStatus } from '@prisma/client';

export const RELATORIOS_QUEUE = 'relatorios';

export interface FiltrosExportacao {
  competenciaId: string;
  status?: SubmissaoStatus;
  municipioId?: number;
  regionalId?: string;
}

export interface ExportJobData {
  filtros: FiltrosExportacao;
  solicitanteId: string;
}

export interface ExportJobResultado {
  arquivoId: string;
  chave: string;
  nome: string;
}

/** Tamanho do lote de leitura por cursor — mantém a memória limitada. */
const LOTE = 5000;

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

function mascaraCpf(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '***.$2.$3-**');
}

@Injectable()
export class RelatoriosService {
  private readonly logger = new Logger(RelatoriosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue(RELATORIOS_QUEUE) private readonly fila: Queue,
  ) {}

  // ── Enfileiramento e consulta de jobs ──────────────────────────────────────

  /** Enfileira a geração do Excel e retorna o ID do job para acompanhamento. */
  async enfileirarExport(filtros: FiltrosExportacao, solicitanteId: string): Promise<string> {
    const competencia = await this.prisma.competencia.findUnique({
      where: { id: filtros.competenciaId },
      select: { id: true },
    });
    if (!competencia) throw new NotFoundException('Competência não encontrada');

    const job = await this.fila.add(
      'exportar-submissoes',
      { filtros, solicitanteId } satisfies ExportJobData,
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
    const { filtros } = job.data;
    const competencia = await this.prisma.competencia.findUnique({
      where: { id: filtros.competenciaId },
    });
    if (!competencia) throw new NotFoundException('Competência não encontrada');

    const where: Prisma.SubmissaoWhereInput = {
      competenciaId: filtros.competenciaId,
      ...(filtros.status ? { status: filtros.status } : {}),
      ...(filtros.municipioId ? { municipioId: filtros.municipioId } : {}),
      ...(filtros.regionalId ? { municipio: { regionalId: filtros.regionalId } } : {}),
    };

    const tmpPath = path.join(os.tmpdir(), `export-${randomUUID()}.xlsx`);

    try {
      await this.gerarExcelStream(tmpPath, competencia.nome, where, job);

      const nome = `submissoes_${filtros.competenciaId}_${Date.now()}.xlsx`;
      const arquivo = await this.storage.salvarDeCaminho(
        tmpPath,
        nome,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );

      this.logger.log(`[job ${job.id}] Export concluído: arquivo=${arquivo.id} (${arquivo.tamanhoBytes} bytes)`);
      return { arquivoId: arquivo.id, chave: arquivo.chave, nome };
    } finally {
      await fs.promises.rm(tmpPath, { force: true });
    }
  }

  /** Escreve o workbook em disco lendo as submissões em lotes por cursor. */
  private async gerarExcelStream(
    tmpPath: string,
    competenciaNome: string,
    where: Prisma.SubmissaoWhereInput,
    job: Job<ExportJobData>,
  ): Promise<void> {
    const total = await this.prisma.submissao.count({ where });

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: tmpPath });
    workbook.creator = 'Plataforma Defesa Civil MG';

    const sheet = workbook.addWorksheet('Submissões');

    const cabecalhos = [
      { header: 'Protocolo', width: 22 },
      { header: 'Município', width: 28 },
      { header: 'Regional (REDEC)', width: 24 },
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
    sheet.columns = cabecalhos.map((c, i) => ({ header: c.header, key: `col${i}`, width: c.width }));

    const linhaHeader = sheet.getRow(1);
    linhaHeader.values = cabecalhos.map((c) => c.header);
    linhaHeader.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    linhaHeader.commit();

    let processados = 0;
    let cursor: string | undefined;

    for (;;) {
      const lote = await this.prisma.submissao.findMany({
        where,
        select: {
          id: true,
          protocolo: true,
          status: true,
          nomeRespondente: true,
          cpfRespondente: true,
          cargoRespondente: true,
          emailRespondente: true,
          enviadoEm: true,
          aprovadoEm: true,
          municipio: { select: { nome: true, regional: { select: { nome: true } } } },
          formularioVersao: { select: { versao: true, formulario: { select: { nome: true } } } },
        },
        orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
        take: LOTE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });

      if (lote.length === 0) break;

      for (const s of lote) {
        const linha = sheet.addRow([
          s.protocolo ?? '—',
          s.municipio.nome,
          s.municipio.regional?.nome ?? '—',
          s.formularioVersao.formulario.nome,
          `v${s.formularioVersao.versao}`,
          LABEL_STATUS[s.status] ?? s.status,
          s.nomeRespondente,
          mascaraCpf(s.cpfRespondente),
          s.cargoRespondente ?? '—',
          s.emailRespondente ?? '—',
          s.enviadoEm ? s.enviadoEm.toLocaleString('pt-BR') : '—',
          s.aprovadoEm ? s.aprovadoEm.toLocaleString('pt-BR') : '—',
        ]);
        const celulaStatus = linha.getCell(6);
        celulaStatus.font = { bold: true, color: { argb: STATUS_CORES[s.status] ?? 'FF94A3B8' } };
        linha.getCell(1).font = { name: 'Courier New', size: 10 };
        linha.commit();
      }

      processados += lote.length;
      cursor = lote[lote.length - 1]!.id;
      if (total > 0) await job.updateProgress(Math.round((processados / total) * 100));
      if (lote.length < LOTE) break;
    }

    sheet.commit();

    // Aba de resumo — contadores via groupBy (não percorre todas as linhas em JS).
    const porStatus = await this.prisma.submissao.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });
    const contagem = new Map(porStatus.map((g) => [g.status as string, g._count._all]));
    const aprovadas = contagem.get('APROVADO') ?? 0;
    const pendentes = total - aprovadas - (contagem.get('RASCUNHO') ?? 0) - (contagem.get('EM_PREENCHIMENTO') ?? 0);

    const abaResumo = workbook.addWorksheet('Resumo');
    abaResumo.addRow(['Competência', competenciaNome]).commit();
    abaResumo.addRow(['Total exportado', total]).commit();
    abaResumo.addRow(['Aprovadas', aprovadas]).commit();
    abaResumo.addRow(['Pendentes', pendentes]).commit();
    abaResumo.addRow(['Data de exportação', new Date().toLocaleString('pt-BR')]).commit();
    abaResumo.commit();

    await workbook.commit();
  }
}
