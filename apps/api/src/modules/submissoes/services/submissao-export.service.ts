import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { formatarResposta } from '@dcmg/contracts';
import type { SchemaFormulario } from '@dcmg/contracts';
import { mascaraCpf } from '../../../shared/utils/format.util';

/** Dados necessários para gerar o documento de uma submissão (PDF/Excel). */
export interface DetalheExport {
  protocolo: string | null;
  status: string;
  nomeRespondente: string;
  cpfRespondente: string;
  cargoRespondente: string | null;
  emailRespondente: string | null;
  criadoEm: Date | string;
  enviadoEm: Date | string | null;
  aprovadoEm: Date | string | null;
  municipio: { nome: string; uf: { sigla: string } };
  formularioVersao: { versao: number; formulario: { nome: string } };
  competencia: { nome: string };
  schema: SchemaFormulario;
  dados: Record<string, unknown>;
  anexos: Array<{ arquivo: { nomeOriginal: string } }>;
}

interface SecaoExport {
  titulo: string;
  campos: { rotulo: string; valor: string }[];
}

const LABEL_STATUS: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  EM_PREENCHIMENTO: 'Em preenchimento',
  ENVIADO: 'Enviado',
  CORRECAO_SOLICITADA: 'Correção solicitada',
  REVISADO: 'Revisado',
  APROVADO: 'Aprovado',
};

function formatarData(valor: Date | string | null): string {
  if (!valor) return '—';
  return new Date(valor).toLocaleString('pt-BR');
}

/** Achata o schema composto em seções com pares rótulo→valor preenchidos. */
function coletarSecoes(schema: SchemaFormulario, dados: Record<string, unknown>): SecaoExport[] {
  const secoes = schema.paginas?.length
    ? schema.paginas.flatMap((p) => p.secoes ?? [])
    : (schema.secoes ?? []);

  return secoes.map((secao) => ({
    titulo: secao.titulo,
    campos: (secao.perguntas ?? []).map((pergunta) => ({
      rotulo: pergunta.rotulo,
      // Formatação isomórfica (mesma do web) — trata GRUPO/MUNICIPIO/múltipla.
      valor: formatarResposta(pergunta, dados[pergunta.codigo]),
    })),
  }));
}

/** Gera os pares de metadados (cabeçalho) da submissão. */
function metadados(detalhe: DetalheExport): { rotulo: string; valor: string }[] {
  return [
    { rotulo: 'Protocolo', valor: detalhe.protocolo ?? '—' },
    { rotulo: 'Formulário', valor: `${detalhe.formularioVersao.formulario.nome} (v${detalhe.formularioVersao.versao})` },
    { rotulo: 'Competência', valor: detalhe.competencia.nome },
    { rotulo: 'Município', valor: `${detalhe.municipio.nome} — ${detalhe.municipio.uf.sigla}` },
    { rotulo: 'Status', valor: LABEL_STATUS[detalhe.status] ?? detalhe.status },
    { rotulo: 'Respondente', valor: detalhe.nomeRespondente },
    { rotulo: 'CPF', valor: mascaraCpf(detalhe.cpfRespondente) },
    { rotulo: 'Cargo', valor: detalhe.cargoRespondente ?? '—' },
    { rotulo: 'E-mail', valor: detalhe.emailRespondente ?? '—' },
    { rotulo: 'Criado em', valor: formatarData(detalhe.criadoEm) },
    { rotulo: 'Enviado em', valor: formatarData(detalhe.enviadoEm) },
    { rotulo: 'Aprovado em', valor: formatarData(detalhe.aprovadoEm) },
  ];
}

/** Gera os documentos (PDF/Excel) de uma submissão individual. */
@Injectable()
export class SubmissaoExportService {
  async gerarExcel(detalhe: DetalheExport): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Plataforma Defesa Civil MG';
    const ws = wb.addWorksheet('Submissão');
    ws.columns = [
      { key: 'campo', width: 42 },
      { key: 'valor', width: 60 },
    ];

    const tituloLinha = ws.addRow([`Submissão — ${detalhe.protocolo ?? ''}`]);
    tituloLinha.font = { bold: true, size: 14 };
    ws.addRow([]);

    this.adicionarBlocoExcel(ws, 'Identificação', metadados(detalhe));

    for (const secao of coletarSecoes(detalhe.schema, detalhe.dados)) {
      this.adicionarBlocoExcel(
        ws,
        secao.titulo,
        secao.campos.map((c) => ({ rotulo: c.rotulo, valor: c.valor })),
      );
    }

    if (detalhe.anexos.length) {
      this.adicionarBlocoExcel(
        ws,
        'Anexos',
        detalhe.anexos.map((a, i) => ({ rotulo: `Arquivo ${i + 1}`, valor: a.arquivo.nomeOriginal })),
      );
    }

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private adicionarBlocoExcel(
    ws: ExcelJS.Worksheet,
    titulo: string,
    pares: { rotulo: string; valor: string }[],
  ): void {
    const header = ws.addRow([titulo]);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    ws.mergeCells(`A${header.number}:B${header.number}`);

    for (const par of pares) {
      const linha = ws.addRow([par.rotulo, par.valor]);
      linha.getCell(1).font = { bold: true };
      linha.getCell(1).alignment = { vertical: 'top' };
      linha.getCell(2).alignment = { vertical: 'top', wrapText: true };
    }
    ws.addRow([]);
  }

  gerarPdf(detalhe: DetalheExport): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(16).font('Helvetica-Bold').text('Plataforma Defesa Civil MG', { align: 'left' });
      doc.moveDown(0.2);
      doc.fontSize(12).font('Helvetica').fillColor('#475569')
        .text(`Submissão ${detalhe.protocolo ?? ''}`);
      doc.fillColor('#000000').moveDown(0.8);

      this.adicionarBlocoPdf(doc, 'Identificação', metadados(detalhe));
      for (const secao of coletarSecoes(detalhe.schema, detalhe.dados)) {
        this.adicionarBlocoPdf(doc, secao.titulo, secao.campos);
      }
      if (detalhe.anexos.length) {
        this.adicionarBlocoPdf(
          doc,
          'Anexos',
          detalhe.anexos.map((a, i) => ({ rotulo: `Arquivo ${i + 1}`, valor: a.arquivo.nomeOriginal })),
        );
      }

      doc.end();
    });
  }

  private adicionarBlocoPdf(
    doc: PDFKit.PDFDocument,
    titulo: string,
    pares: { rotulo: string; valor: string }[],
  ): void {
    if (doc.y > 720) doc.addPage();
    doc.moveDown(0.4);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1E3A5F').text(titulo);
    doc.moveTo(doc.x, doc.y).lineTo(548, doc.y).strokeColor('#1E3A5F').stroke();
    doc.moveDown(0.3);
    doc.fillColor('#000000').fontSize(10).font('Helvetica');

    for (const par of pares) {
      if (doc.y > 770) doc.addPage();
      doc.font('Helvetica-Bold').text(`${par.rotulo}: `, { continued: true });
      doc.font('Helvetica').text(par.valor);
    }
  }
}
