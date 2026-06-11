import { Injectable, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SubmissaoStatus } from '@prisma/client';

interface FiltrosExportacao {
  competenciaId: string;
  status?: SubmissaoStatus;
  municipioId?: number;
  regionalId?: string;
}

const LABEL_STATUS: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  EM_PREENCHIMENTO: 'Em preenchimento',
  ENVIADO: 'Enviado',
  CORRECAO_SOLICITADA: 'Correção solicitada',
  REVISADO: 'Revisado',
  APROVADO: 'Aprovado',
};

function mascaraCpf(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '***.$2.$3-**');
}

@Injectable()
export class RelatoriosService {
  constructor(private readonly prisma: PrismaService) {}

  async exportarSubmissoes(filtros: FiltrosExportacao): Promise<Buffer> {
    const competencia = await this.prisma.competencia.findUnique({
      where: { id: filtros.competenciaId },
    });
    if (!competencia) throw new NotFoundException('Competência não encontrada');

    const submissoes = await this.prisma.submissao.findMany({
      where: {
        competenciaId: filtros.competenciaId,
        ...(filtros.status ? { status: filtros.status } : {}),
        ...(filtros.municipioId ? { municipioId: filtros.municipioId } : {}),
        ...(filtros.regionalId
          ? { municipio: { regionalId: filtros.regionalId } }
          : {}),
      },
      select: {
        protocolo: true,
        status: true,
        nomeRespondente: true,
        cpfRespondente: true,
        cargoRespondente: true,
        emailRespondente: true,
        telefoneRespondente: true,
        enviadoEm: true,
        aprovadoEm: true,
        criadoEm: true,
        municipio: {
          select: {
            nome: true,
            regional: { select: { nome: true } },
          },
        },
        formularioVersao: {
          select: {
            versao: true,
            formulario: { select: { nome: true } },
          },
        },
      },
      orderBy: { criadoEm: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Plataforma Defesa Civil MG';

    const sheet = workbook.addWorksheet('Submissões', {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });

    // cabeçalho institucional
    sheet.mergeCells('A1:L1');
    const titulo = sheet.getCell('A1');
    titulo.value = `Relatório de Submissões — ${competencia.nome}`;
    titulo.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF97316' } };
    titulo.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 28;

    sheet.mergeCells('A2:L2');
    const subtitulo = sheet.getCell('A2');
    subtitulo.value = `Exportado em ${new Date().toLocaleString('pt-BR')} — CEDEC/MG`;
    subtitulo.font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
    subtitulo.alignment = { horizontal: 'center' };
    sheet.getRow(2).height = 18;

    // linha em branco de separação
    sheet.getRow(3).height = 8;

    // cabeçalhos das colunas
    const cabecalhos = [
      { header: 'Protocolo', key: 'protocolo', width: 22 },
      { header: 'Município', key: 'municipio', width: 28 },
      { header: 'Regional (REDEC)', key: 'regional', width: 24 },
      { header: 'Formulário', key: 'formulario', width: 28 },
      { header: 'Versão', key: 'versao', width: 10 },
      { header: 'Status', key: 'status', width: 22 },
      { header: 'Respondente', key: 'respondente', width: 30 },
      { header: 'CPF (mascarado)', key: 'cpf', width: 20 },
      { header: 'Cargo', key: 'cargo', width: 22 },
      { header: 'E-mail', key: 'email', width: 28 },
      { header: 'Enviado em', key: 'enviadoEm', width: 20 },
      { header: 'Aprovado em', key: 'aprovadoEm', width: 20 },
    ];

    sheet.columns = cabecalhos;

    const linhaHeader = sheet.getRow(4);
    linhaHeader.values = cabecalhos.map((c) => c.header);
    linhaHeader.height = 22;
    linhaHeader.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFF97316' } },
      };
    });

    // ajusta largura das colunas
    sheet.columns = cabecalhos.map((c, i) => ({
      ...c,
      key: `col${i}`,
      width: c.width,
    }));

    // dados
    const STATUS_CORES: Record<string, string> = {
      APROVADO: 'FF22C55E',
      CORRECAO_SOLICITADA: 'FFEAB308',
      ENVIADO: 'FF60A5FA',
      REVISADO: 'FF34D399',
      EM_PREENCHIMENTO: 'FFA78BFA',
      RASCUNHO: 'FF94A3B8',
    };

    for (let i = 0; i < submissoes.length; i++) {
      const s = submissoes[i];
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

      linha.height = 18;

      // zebrado
      if (i % 2 === 0) {
        linha.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111D3B' } };
        });
      }

      // colorir coluna de status
      const celulaStatus = linha.getCell(6);
      celulaStatus.font = {
        bold: true,
        color: { argb: STATUS_CORES[s.status] ?? 'FF94A3B8' },
      };

      // coluna de protocolo em fonte monoespaçada
      linha.getCell(1).font = { name: 'Courier New', size: 10 };
    }

    // aba de resumo
    const abaResumo = workbook.addWorksheet('Resumo');
    abaResumo.getCell('A1').value = 'Competência';
    abaResumo.getCell('B1').value = competencia.nome;
    abaResumo.getCell('A2').value = 'Total exportado';
    abaResumo.getCell('B2').value = submissoes.length;
    abaResumo.getCell('A3').value = 'Aprovadas';
    abaResumo.getCell('B3').value = submissoes.filter((s) => s.status === 'APROVADO').length;
    abaResumo.getCell('A4').value = 'Pendentes';
    abaResumo.getCell('B4').value = submissoes.filter(
      (s) => !['APROVADO', 'RASCUNHO', 'EM_PREENCHIMENTO'].includes(s.status),
    ).length;
    abaResumo.getCell('A5').value = 'Data de exportação';
    abaResumo.getCell('B5').value = new Date().toLocaleString('pt-BR');

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
