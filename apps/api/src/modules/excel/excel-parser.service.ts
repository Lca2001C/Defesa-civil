import { Injectable, BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type {
  SchemaFormulario,
  SecaoFormulario,
  CampoFormulario,
} from '@dcmg/contracts';
import { TipoCampo } from '@dcmg/contracts';

const NOME_SHEET_DEF = ['Definicoes', 'Definições', 'Definicao', 'Definição', 'Config', 'Schema'];

/** Normaliza texto para uso como chave: minúsculo, sem acentos, underline. */
function toChave(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Garante chaves únicas dentro de uma lista de campos. */
function dedupChaves(campos: CampoFormulario[]): CampoFormulario[] {
  const vistos = new Map<string, number>();
  return campos.map((campo) => {
    const base = campo.chave || 'campo';
    const count = vistos.get(base) ?? 0;
    vistos.set(base, count + 1);
    return count === 0 ? campo : { ...campo, chave: `${base}_${count + 1}` };
  });
}

/** Infere TipoCampo a partir do rótulo e amostras de valores. */
function inferirTipo(rotulo: string, amostras: unknown[]): TipoCampo {
  const rot = rotulo.toLowerCase();
  if (/\bcpf\b/.test(rot)) return TipoCampo.CPF;
  if (/\bcnpj\b/.test(rot)) return TipoCampo.CNPJ;
  if (/\bcep\b/.test(rot)) return TipoCampo.CEP;
  if (/valor|custo|montante|pre[cç]o/.test(rot)) return TipoCampo.MOEDA;

  const vals = amostras.filter((v) => v !== null && v !== undefined && v !== '');
  if (vals.length === 0) return TipoCampo.TEXTO;

  const todasDatas = vals.every((v) => v instanceof Date || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(String(v)));
  if (todasDatas) return TipoCampo.DATA;

  const todosNums = vals.every((v) => typeof v === 'number' || /^-?\d+([.,]\d+)?$/.test(String(v)));
  if (todosNums) return TipoCampo.NUMERO;

  const todosBool = vals.every((v) =>
    /^(sim|nao|não|true|false|s|n|yes|no|1|0)$/i.test(String(v)),
  );
  if (todosBool) return TipoCampo.BOOLEANO;

  const distintos = new Set(vals.map((v) => String(v).trim().toLowerCase()));
  if (distintos.size <= 10 && vals.length >= 5) return TipoCampo.SELECT;

  return TipoCampo.TEXTO;
}

/** Mapeia string de tipo (da aba Definições) para TipoCampo. */
function parseTipo(raw: string): TipoCampo {
  const tipos: Record<string, TipoCampo> = {
    TEXTO: TipoCampo.TEXTO,
    NUMERO: TipoCampo.NUMERO,
    'NÚMERO': TipoCampo.NUMERO,
    DATA: TipoCampo.DATA,
    SELECT: TipoCampo.SELECT,
    MULTISELECT: TipoCampo.MULTISELECT,
    BOOLEANO: TipoCampo.BOOLEANO,
    CPF: TipoCampo.CPF,
    CNPJ: TipoCampo.CNPJ,
    CEP: TipoCampo.CEP,
    MOEDA: TipoCampo.MOEDA,
    ARQUIVO: TipoCampo.ARQUIVO,
  };
  return tipos[raw.toUpperCase().trim()] ?? TipoCampo.TEXTO;
}

@Injectable()
export class ExcelParserService {
  /** Fluxo A: lê um .xlsx e devolve um SchemaFormulario (rascunho). */
  async parsearTemplate(buffer: Buffer, titulo?: string): Promise<SchemaFormulario> {
    const workbook = new ExcelJS.Workbook();
    // ExcelJS v4 tem incompatibilidade de tipos com @types/node >= 22
    await workbook.xlsx.load(buffer as any);

    if (workbook.worksheets.length === 0) {
      throw new BadRequestException('O arquivo Excel não contém nenhuma aba.');
    }

    // Tenta encontrar aba de definições explícita
    const sheetDef = workbook.worksheets.find((s) =>
      NOME_SHEET_DEF.some((n) => s.name.trim().toLowerCase() === n.toLowerCase()),
    );

    if (sheetDef) {
      return this.parseSheetDefinicoes(sheetDef, workbook, titulo);
    }

    // Inferência a partir da primeira aba de dados
    return this.inferirSchemaDeDados(workbook.worksheets[0], titulo);
  }

  /** Lê aba "Definições" com colunas: chave | rotulo | tipo | obrigatorio | opcoes | ajuda */
  private parseSheetDefinicoes(
    sheet: ExcelJS.Worksheet,
    workbook: ExcelJS.Workbook,
    titulo?: string,
  ): SchemaFormulario {
    const campos: CampoFormulario[] = [];
    let secaoAtual: SecaoFormulario | null = null;
    const secoes: SecaoFormulario[] = [];

    sheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return; // cabeçalho

      const chaveRaw = String(row.getCell(1).value ?? '').trim();
      const rotulo = String(row.getCell(2).value ?? '').trim();
      const tipoRaw = String(row.getCell(3).value ?? 'TEXTO').trim();
      const obrigRaw = String(row.getCell(4).value ?? 'nao').trim().toLowerCase();
      const opcoesRaw = String(row.getCell(5).value ?? '').trim();
      const ajuda = String(row.getCell(6).value ?? '').trim();

      if (!rotulo) return;

      // Linha de seção: tipo = SECAO ou chave vazia
      if (tipoRaw.toUpperCase() === 'SECAO' || tipoRaw.toUpperCase() === 'SEÇÃO') {
        secaoAtual = { chave: toChave(rotulo), titulo: rotulo, campos: [] };
        secoes.push(secaoAtual);
        return;
      }

      if (!secaoAtual) {
        secaoAtual = { chave: 'geral', titulo: 'Geral', campos: [] };
        secoes.push(secaoAtual);
      }

      const chave = chaveRaw || toChave(rotulo);
      const tipo = parseTipo(tipoRaw);
      const obrigatorio = ['sim', 's', 'true', '1', 'yes'].includes(obrigRaw);

      const campo: CampoFormulario = {
        chave,
        rotulo,
        tipo,
        obrigatorio,
        ajuda: ajuda || undefined,
      };

      if (opcoesRaw && [TipoCampo.SELECT, TipoCampo.MULTISELECT].includes(tipo)) {
        campo.opcoes = opcoesRaw.split(';').map((o) => ({
          valor: toChave(o.trim()),
          rotulo: o.trim(),
        }));
      }

      secaoAtual.campos.push(campo);
    });

    // Dedup chaves dentro de cada seção
    secoes.forEach((s) => { s.campos = dedupChaves(s.campos); });

    // Se a definição aponta para outra aba de dados, colhe opcoes de lá
    // (funcionalidade futura; por ora usamos o opcoesRaw)

    return {
      versao: 1,
      titulo: titulo ?? sheet.workbook?.title ?? 'Formulário importado',
      secoes: secoes.length > 0 ? secoes : [{ chave: 'geral', titulo: 'Geral', campos }],
    };
  }

  /** Infere o schema a partir dos cabeçalhos e amostras da aba de dados. */
  private inferirSchemaDeDados(
    sheet: ExcelJS.Worksheet,
    titulo?: string,
  ): SchemaFormulario {
    if (sheet.rowCount < 1) {
      throw new BadRequestException('A aba de dados está vazia.');
    }

    const headerRow = sheet.getRow(1);
    const numCols = headerRow.actualCellCount;

    // Coletar amostras (linhas 2–11)
    const amostras: unknown[][] = [];
    const maxAmostra = Math.min(sheet.rowCount, 11);
    for (let r = 2; r <= maxAmostra; r++) {
      const row = sheet.getRow(r);
      const vals: unknown[] = [];
      for (let c = 1; c <= numCols; c++) {
        vals.push(row.getCell(c).value);
      }
      amostras.push(vals);
    }

    const campos: CampoFormulario[] = [];
    for (let c = 1; c <= numCols; c++) {
      const rotulo = String(headerRow.getCell(c).value ?? '').trim();
      if (!rotulo) continue;
      const colAmostras = amostras.map((a) => a[c - 1]);
      campos.push({
        chave: toChave(rotulo),
        rotulo,
        tipo: inferirTipo(rotulo, colAmostras),
        obrigatorio: false,
      });
    }

    return {
      versao: 1,
      titulo: titulo ?? sheet.name ?? 'Formulário importado',
      secoes: [{ chave: 'geral', titulo: sheet.name || 'Geral', campos: dedupChaves(campos) }],
    };
  }

  /**
   * Lê a linha de cabeçalho de uma planilha de dados e devolve um mapeamento
   * colIndex → chave de campo (baseado em match exato ou normalizado).
   */
  mapearColunas(
    sheet: ExcelJS.Worksheet,
    schema: SchemaFormulario,
    mapeamentoManual?: Record<string, string>,
  ): Map<number, CampoFormulario> {
    const allCampos = schema.secoes.flatMap((s) => s.campos);
    const headerRow = sheet.getRow(1);
    const mapa = new Map<number, CampoFormulario>();

    headerRow.eachCell((cell, colNum) => {
      const rotulo = String(cell.value ?? '').trim();
      const chaveCol = toChave(rotulo);

      // Mapeamento manual tem prioridade
      const chaveManual = mapeamentoManual?.[rotulo] ?? mapeamentoManual?.[chaveCol];
      const chaveAlvo = chaveManual ?? chaveCol;

      const campo = allCampos.find(
        (c) => c.chave === chaveAlvo || toChave(c.rotulo) === chaveCol,
      );
      if (campo) mapa.set(colNum, campo);
    });

    return mapa;
  }
}
