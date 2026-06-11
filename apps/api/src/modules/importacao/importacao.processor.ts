import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { ExcelParserService } from '../excel/excel-parser.service';
import type { SchemaFormulario, CampoFormulario } from '@dcmg/contracts';
import { TipoCampo } from '@dcmg/contracts';
import { FILA_IMPORTACAO } from './importacao.service';

interface JobPayload {
  loteId: string;
  mapeamento: Record<string, string>;
}

@Processor(FILA_IMPORTACAO)
export class ImportacaoProcessor extends WorkerHost {
  private readonly logger = new Logger(ImportacaoProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly excelParser: ExcelParserService,
  ) {
    super();
  }

  async process(job: Job<JobPayload>): Promise<void> {
    const { loteId, mapeamento } = job.data;
    this.logger.log(`Iniciando importação do lote ${loteId}`);

    await this.prisma.importacaoLote.update({
      where: { id: loteId },
      data: { status: 'PROCESSANDO' },
    });

    try {
      const lote = await this.prisma.importacaoLote.findUniqueOrThrow({
        where: { id: loteId },
        include: {
          formularioVersao: true,
          autor: true,
          arquivo: true,
        },
      });

      if (!lote.arquivo) {
        throw new Error('Lote sem arquivo associado.');
      }

      const rawBuffer = await this.storage.ler(lote.arquivo.chave);
      const buffer = Buffer.from(rawBuffer);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);

      const sheet = workbook.worksheets[0];
      if (!sheet || sheet.rowCount < 2) {
        throw new Error('Planilha de dados vazia ou sem registros.');
      }

      const schema = lote.formularioVersao.schema as unknown as SchemaFormulario;
      const mapaColCampo = this.excelParser.mapearColunas(sheet, schema, mapeamento);

      let linhasValidas = 0;
      let linhasComErro = 0;

      for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum++) {
        const row = sheet.getRow(rowNum);

        // Pular linha vazia
        const temDados = Array.from({ length: row.actualCellCount }, (_, i) =>
          row.getCell(i + 1).value,
        ).some((v) => v !== null && v !== undefined && v !== '');
        if (!temDados) continue;

        await job.updateProgress(Math.round(((rowNum - 2) / (sheet.rowCount - 1)) * 100));

        // Montar dados a partir do mapeamento
        const dados: Record<string, unknown> = {};
        mapaColCampo.forEach((campo, colIdx) => {
          dados[campo.chave] = this.converterValor(row.getCell(colIdx).value, campo);
        });

        // Validar campos obrigatórios
        const errosLinha: string[] = [];
        const allCampos = schema.secoes.flatMap((s) => s.campos);
        for (const campo of allCampos) {
          if (campo.obrigatorio) {
            const val = dados[campo.chave];
            if (val === undefined || val === null || val === '') {
              errosLinha.push(`Campo obrigatório "${campo.rotulo}" não preenchido`);
            }
          }
        }

        if (errosLinha.length > 0) {
          await this.prisma.erroImportacao.create({
            data: {
              loteId,
              linha: rowNum,
              mensagem: errosLinha.join('; '),
            },
          });
          linhasComErro++;
          continue;
        }

        // Determinar municipioId: lote ou coluna "municipio_id"
        const municipioId =
          lote.municipioId ??
          (typeof dados['municipio_id'] === 'number' ? dados['municipio_id'] : null);

        if (!municipioId) {
          await this.prisma.erroImportacao.create({
            data: {
              loteId,
              linha: rowNum,
              mensagem: 'municipio_id não encontrado na linha nem no lote.',
            },
          });
          linhasComErro++;
          continue;
        }

        // Gerar protocolo atômico
        const protocolo = await this.gerarProtocolo('MG', new Date().getFullYear());

        await this.prisma.submissao.create({
          data: {
            protocolo,
            municipioId,
            formularioVersaoId: lote.formularioVersaoId,
            competenciaId: lote.competenciaId,
            autorId: lote.autorId,
            nomeRespondente: lote.autor.nome,
            cpfRespondente: lote.autor.cpf,
            cargoRespondente: lote.autor.cargo ?? null,
            emailRespondente: lote.autor.email,
            status: 'ENVIADA',
            dados: dados as object,
            importacaoLoteId: loteId,
            enviadoEm: new Date(),
          },
        });
        linhasValidas++;
      }

      const statusFinal =
        linhasComErro > 0 && linhasValidas === 0
          ? 'FALHOU'
          : linhasComErro > 0
          ? 'CONCLUIDA_COM_ERROS'
          : 'CONCLUIDA';

      await this.prisma.importacaoLote.update({
        where: { id: loteId },
        data: {
          status: statusFinal,
          totalLinhas: linhasValidas + linhasComErro,
          linhasValidas,
          linhasComErro,
        },
      });

      this.logger.log(
        `Lote ${loteId} concluído: ${linhasValidas} válidas, ${linhasComErro} erros.`,
      );
    } catch (err) {
      this.logger.error(`Falha no lote ${loteId}: ${(err as Error).message}`);
      await this.prisma.importacaoLote.update({
        where: { id: loteId },
        data: { status: 'FALHOU' },
      });
      throw err;
    }
  }

  private converterValor(raw: ExcelJS.CellValue, campo: CampoFormulario): unknown {
    if (raw === null || raw === undefined) return undefined;
    if (raw instanceof Date) {
      if (campo.tipo === TipoCampo.DATA) return raw.toISOString().split('T')[0];
      return raw.toISOString();
    }
    if (typeof raw === 'object' && 'richText' in raw) {
      return (raw as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join('');
    }
    if (typeof raw === 'object' && 'result' in raw) {
      return (raw as ExcelJS.CellFormulaValue).result;
    }
    if (campo.tipo === TipoCampo.BOOLEANO) {
      return /^(sim|s|true|1|yes)$/i.test(String(raw));
    }
    if (campo.tipo === TipoCampo.NUMERO || campo.tipo === TipoCampo.MOEDA) {
      const n = Number(raw);
      return isNaN(n) ? undefined : n;
    }
    return String(raw).trim();
  }

  private async gerarProtocolo(ufSigla: string, ano: number): Promise<string> {
    const seq = await this.prisma.protocoloSequencia.upsert({
      where: { ufSigla_ano: { ufSigla, ano } },
      update: { ultimoNumero: { increment: 1 } },
      create: { ufSigla, ano, ultimoNumero: 1 },
    });
    return `${ufSigla}-${ano}-${String(seq.ultimoNumero).padStart(8, '0')}`;
  }
}
