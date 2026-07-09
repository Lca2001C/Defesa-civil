import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  AcaoCondicional,
  OperadorCondicional,
  TipoPergunta,
  type PaginaFormulario,
  type Pergunta,
  type SchemaFormulario,
  type SecaoFormulario,
} from '@dcmg/contracts';

/** Erro de importação com o número da LINHA da planilha (base 1, com cabeçalho). */
interface ErroImportacao {
  linha: number;
  mensagem: string;
}

/** Uma linha da aba "Perguntas" já normalizada. */
interface LinhaExcel {
  linha: number;
  pagina: string;
  secao: string;
  codigo: string;
  pergunta: string;
  tipo: string;
  obrigatoria: boolean;
  ajuda: string;
  opcoes: string[];
  permiteOutro: boolean;
  multipla: boolean;
  condicionalDe: string;
  condicionalValor: string;
  grupo: string;
  quantidadeDe: string;
  min?: number;
  max?: number;
}

const ABA_PERGUNTAS = 'Perguntas';
const VALOR_OUTRO = 'outro';

/** Colunas esperadas (na ordem da planilha-modelo). */
const COLUNAS = [
  'Pagina',
  'Secao',
  'Codigo',
  'Pergunta',
  'Tipo',
  'Obrigatoria',
  'Ajuda',
  'Opcoes',
  'PermiteOutro',
  'Multipla',
  'CondicionalDe',
  'CondicionalValor',
  'Grupo',
  'QuantidadeDe',
  'Min',
  'Max',
] as const;

const TIPOS_VALIDOS = new Set<string>(Object.values(TipoPergunta));
const TIPOS_COM_OPCOES = new Set<string>([
  TipoPergunta.LISTA_SUSPENSA,
  TipoPergunta.RADIO,
  TipoPergunta.CHECKBOX,
]);
const TIPOS_PROIBIDOS_EM_GRUPO = new Set<string>([
  TipoPergunta.GRUPO,
  TipoPergunta.UPLOAD,
  TipoPergunta.AUTOMATICO,
]);

/**
 * Importa um formulário a partir de uma planilha Excel (.xlsx) no modelo do
 * sistema, e gera a planilha-modelo para download. É a forma de a CEDEC usar
 * o Excel oficial (com as listas 4.x) como base do formulário: uma linha por
 * pergunta; linhas com a coluna "Grupo" preenchida viram subperguntas do grupo
 * repetível indicado.
 */
@Injectable()
export class FormularioImportService {
  // ── Normalização de células ────────────────────────────────────────────────

  private celStr(cell: ExcelJS.Cell): string {
    const v = cell.value;
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') {
      // Fórmula ({ result }) ou rich text ({ richText }).
      const obj = v as { result?: unknown; richText?: { text: string }[]; text?: string };
      if (obj.richText) return obj.richText.map((r) => r.text).join('').trim();
      if (obj.text !== undefined) return String(obj.text).trim();
      if (obj.result !== undefined) return String(obj.result).trim();
      return '';
    }
    return String(v).trim();
  }

  private ehSim(valor: string): boolean {
    return ['s', 'sim', 'true', 'x', '1'].includes(valor.trim().toLowerCase());
  }

  private numeroOuUndef(valor: string): number | undefined {
    if (!valor.trim()) return undefined;
    const n = Number(valor.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  }

  // ── Importação (xlsx -> SchemaFormulario) ────────────────────────────────────

  async parsearSchema(buffer: Buffer): Promise<{ nome: string; schema: SchemaFormulario }> {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    } catch {
      throw new BadRequestException('Arquivo inválido: não foi possível ler o Excel (.xlsx).');
    }

    const ws = wb.getWorksheet(ABA_PERGUNTAS) ?? wb.worksheets[0];
    if (!ws) throw new BadRequestException('Planilha vazia — use a planilha-modelo do sistema.');

    // Mapeia cabeçalho (linha 1) -> índice de coluna, tolerando reordenação.
    const cabecalho = ws.getRow(1);
    const indicePorColuna = new Map<string, number>();
    cabecalho.eachCell((cell, col) => {
      indicePorColuna.set(this.celStr(cell).toLowerCase(), col);
    });
    const col = (nome: string) => indicePorColuna.get(nome.toLowerCase());
    const faltando = COLUNAS.filter((c) => col(c) === undefined);
    if (faltando.length) {
      throw new BadRequestException(
        `Cabeçalho inválido. Colunas ausentes: ${faltando.join(', ')}. Baixe a planilha-modelo.`,
      );
    }

    // Lê as linhas de dados (a partir da linha 2).
    const linhas: LinhaExcel[] = [];
    const erros: ErroImportacao[] = [];
    const total = ws.rowCount;
    for (let r = 2; r <= total; r++) {
      const row = ws.getRow(r);
      const get = (nome: string) => this.celStr(row.getCell(col(nome)!));
      const codigo = get('Codigo').replace(/\s+/g, '_').toLowerCase();
      const rotulo = get('Pergunta');
      // Linha totalmente vazia: ignora.
      if (!codigo && !rotulo && !get('Tipo')) continue;

      linhas.push({
        linha: r,
        pagina: get('Pagina') || 'Página 1',
        secao: get('Secao') || 'Seção 1',
        codigo,
        pergunta: rotulo,
        tipo: get('Tipo').toUpperCase(),
        obrigatoria: this.ehSim(get('Obrigatoria')),
        ajuda: get('Ajuda'),
        opcoes: get('Opcoes')
          .split(';')
          .map((o) => o.trim())
          .filter(Boolean),
        permiteOutro: this.ehSim(get('PermiteOutro')),
        multipla: this.ehSim(get('Multipla')),
        condicionalDe: get('CondicionalDe').replace(/\s+/g, '_').toLowerCase(),
        condicionalValor: get('CondicionalValor'),
        grupo: get('Grupo').replace(/\s+/g, '_').toLowerCase(),
        quantidadeDe: get('QuantidadeDe').replace(/\s+/g, '_').toLowerCase(),
        min: this.numeroOuUndef(get('Min')),
        max: this.numeroOuUndef(get('Max')),
      });
    }

    if (linhas.length === 0) {
      throw new BadRequestException('Nenhuma pergunta encontrada na planilha.');
    }

    // Validações por linha (com número da linha) antes de montar o schema.
    const codigos = new Map<string, LinhaExcel>();
    for (const l of linhas) {
      if (!l.codigo) erros.push({ linha: l.linha, mensagem: 'Coluna "Codigo" é obrigatória.' });
      else if (codigos.has(l.codigo)) {
        erros.push({ linha: l.linha, mensagem: `Código duplicado: "${l.codigo}".` });
      } else codigos.set(l.codigo, l);

      if (!l.pergunta) erros.push({ linha: l.linha, mensagem: 'Coluna "Pergunta" é obrigatória.' });
      if (!TIPOS_VALIDOS.has(l.tipo)) {
        erros.push({ linha: l.linha, mensagem: `Tipo inválido: "${l.tipo}".` });
      }
      if (TIPOS_COM_OPCOES.has(l.tipo) && l.opcoes.length === 0) {
        erros.push({ linha: l.linha, mensagem: `O tipo ${l.tipo} exige "Opcoes" (separadas por ";").` });
      }
    }

    // Referências cruzadas (grupo, condicional, quantidade).
    for (const l of linhas) {
      if (l.grupo) {
        const pai = codigos.get(l.grupo);
        if (!pai) erros.push({ linha: l.linha, mensagem: `Grupo "${l.grupo}" não existe.` });
        else if (pai.tipo !== TipoPergunta.GRUPO) {
          erros.push({ linha: l.linha, mensagem: `"${l.grupo}" não é do tipo GRUPO.` });
        }
        if (TIPOS_PROIBIDOS_EM_GRUPO.has(l.tipo)) {
          erros.push({
            linha: l.linha,
            mensagem: `Tipo ${l.tipo} não é permitido dentro de um grupo repetível.`,
          });
        }
      }
      if (l.condicionalDe && !codigos.has(l.condicionalDe)) {
        erros.push({ linha: l.linha, mensagem: `CondicionalDe "${l.condicionalDe}" não existe.` });
      }
      if (l.tipo === TipoPergunta.GRUPO && l.quantidadeDe) {
        const origem = codigos.get(l.quantidadeDe);
        if (!origem || origem.tipo !== TipoPergunta.NUMERO || origem.grupo) {
          erros.push({
            linha: l.linha,
            mensagem: `QuantidadeDe "${l.quantidadeDe}" deve ser uma pergunta NUMERO fora de grupos.`,
          });
        }
      }
    }

    if (erros.length) {
      throw new BadRequestException({ message: 'Planilha com erros — corrija e reenvie.', erros });
    }

    const schema = this.montarSchema(linhas);
    // Nome do formulário: título informado nas Instruções (B1) ou padrão.
    const nomeInstr = this.lerNomeFormulario(wb);
    const nome = nomeInstr || 'Formulário importado';
    return { nome, schema: { ...schema, titulo: nomeInstr || undefined } };
  }

  /** Lê o nome do formulário na aba "Instrucoes" (célula B1), se presente. */
  private lerNomeFormulario(wb: ExcelJS.Workbook): string {
    const instr = wb.getWorksheet('Instrucoes');
    if (!instr) return '';
    const b1 = this.celStr(instr.getCell('B1'));
    return b1;
  }

  /** Converte uma linha (com "Outro" e condicional) numa ou duas Perguntas. */
  private linhaParaPerguntas(l: LinhaExcel): Pergunta[] {
    const tipo = l.tipo as TipoPergunta;
    const pergunta: Pergunta = {
      codigo: l.codigo,
      rotulo: l.pergunta,
      tipo,
      obrigatorio: l.obrigatoria,
      ajuda: l.ajuda || undefined,
    };

    if (TIPOS_COM_OPCOES.has(l.tipo)) {
      pergunta.opcoes = l.opcoes.map((rot) => ({
        valor: rot.replace(/\s+/g, '_').toLowerCase(),
        rotulo: rot,
      }));
      if (l.permiteOutro) pergunta.opcoes.push({ valor: VALOR_OUTRO, rotulo: 'Outro(s)' });
      if (tipo === TipoPergunta.LISTA_SUSPENSA && l.multipla) pergunta.multipla = true;
    }

    if (l.condicionalDe) {
      pergunta.regras = [
        {
          origemCodigo: l.condicionalDe,
          operador: OperadorCondicional.IGUAL,
          valor: l.condicionalValor,
          acao: AcaoCondicional.MOSTRAR,
        },
      ];
    }

    if (tipo === TipoPergunta.GRUPO) {
      if (l.quantidadeDe) pergunta.quantidadeOrigemCodigo = l.quantidadeDe;
      if (l.min !== undefined) pergunta.minInstancias = l.min;
      if (l.max !== undefined) pergunta.maxInstancias = l.max;
      pergunta.perguntas = [];
    } else if (l.min !== undefined || l.max !== undefined) {
      pergunta.validacoes = { min: l.min, max: l.max };
    }

    const perguntas: Pergunta[] = [pergunta];

    // "Outro(s)" com especificação obrigatória: pergunta companheira condicional.
    if (l.permiteOutro && TIPOS_COM_OPCOES.has(l.tipo)) {
      perguntas.push({
        codigo: `${l.codigo}_outro`,
        rotulo: `${l.pergunta} — especifique`,
        tipo: TipoPergunta.TEXTO_CURTO,
        obrigatorio: true,
        regras: [
          {
            origemCodigo: l.codigo,
            operador: OperadorCondicional.IGUAL,
            valor: VALOR_OUTRO,
            acao: AcaoCondicional.MOSTRAR,
          },
        ],
      });
    }
    return perguntas;
  }

  /** Monta o SchemaFormulario preservando a ordem de páginas/seções/perguntas. */
  private montarSchema(linhas: LinhaExcel[]): SchemaFormulario {
    // Subperguntas por grupo (código do grupo -> perguntas geradas).
    const subPorGrupo = new Map<string, Pergunta[]>();
    for (const l of linhas) {
      if (l.grupo) {
        const lista = subPorGrupo.get(l.grupo) ?? [];
        lista.push(...this.linhaParaPerguntas(l));
        subPorGrupo.set(l.grupo, lista);
      }
    }

    const paginas: PaginaFormulario[] = [];
    const paginaPorTitulo = new Map<string, PaginaFormulario>();
    const secaoPorChave = new Map<string, SecaoFormulario>();

    for (const l of linhas) {
      if (l.grupo) continue; // subperguntas entram no grupo, não na seção

      let pagina = paginaPorTitulo.get(l.pagina);
      if (!pagina) {
        pagina = { titulo: l.pagina, secoes: [] };
        paginaPorTitulo.set(l.pagina, pagina);
        paginas.push(pagina);
      }

      const chaveSecao = `${l.pagina} ${l.secao}`;
      let secao = secaoPorChave.get(chaveSecao);
      if (!secao) {
        secao = { titulo: l.secao, perguntas: [] };
        secaoPorChave.set(chaveSecao, secao);
        pagina.secoes.push(secao);
      }

      for (const p of this.linhaParaPerguntas(l)) {
        if (p.tipo === TipoPergunta.GRUPO) {
          p.perguntas = subPorGrupo.get(p.codigo) ?? [];
        }
        secao.perguntas.push(p);
      }
    }

    return { versao: 1, paginas };
  }

  // ── Geração da planilha-modelo ───────────────────────────────────────────────

  /** Gera o .xlsx modelo (aba Perguntas + Instrucoes) com exemplos do COMPDEC. */
  async gerarModelo(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SIG Defesa Civil MG';

    // Aba Instrucoes: nome do formulário (B1) + legenda.
    const instr = wb.addWorksheet('Instrucoes');
    instr.getCell('A1').value = 'Nome do formulário:';
    instr.getCell('B1').value = 'Caracterização Municipal da COMPDEC';
    instr.getColumn(1).width = 26;
    instr.getColumn(2).width = 60;
    const legenda: [string, string][] = [
      ['Tipo', `Um de: ${Object.values(TipoPergunta).join(', ')}`],
      ['Obrigatoria / PermiteOutro / Multipla', 'Use S ou N'],
      ['Opcoes', 'Rótulos separados por ";" (ex.: Rádio; Sirene; Aplicativo)'],
      ['CondicionalDe + CondicionalValor', 'Mostra a pergunta só quando a origem == valor (Sim/Não use true/false)'],
      ['Grupo', 'Código de uma pergunta GRUPO — a linha vira subpergunta desse grupo'],
      ['QuantidadeDe', 'No GRUPO: código de uma pergunta NUMERO que define quantos registros abrir'],
      ['Min / Max', 'Texto/Número: limites; no GRUPO sem QuantidadeDe: mín./máx. de registros'],
      ['PermiteOutro', 'Gera a opção "Outro(s)" + um campo de especificação obrigatório automático'],
    ];
    instr.getCell('A3').value = 'Legenda das colunas';
    instr.getCell('A3').font = { bold: true };
    legenda.forEach(([k, v], i) => {
      instr.getCell(`A${4 + i}`).value = k;
      instr.getCell(`B${4 + i}`).value = v;
    });

    // Aba Perguntas: cabeçalho + linhas de exemplo.
    const ws = wb.addWorksheet(ABA_PERGUNTAS);
    ws.addRow([...COLUNAS]);
    ws.getRow(1).font = { bold: true };
    ws.columns = COLUNAS.map((c) => ({ width: Math.max(12, c.length + 2) }));

    const exemplos: (string | number)[][] = [
      // Página 1 — identificação e um "Outro(s)"
      ['Identificação', 'Município', 'municipio_atual', 'Município', 'AUTOMATICO', 'S', 'Preenchido pelo sistema', '', '', '', '', '', '', '', '', ''],
      ['Identificação', 'Identificação', 'cargo_funcao', 'Cargo/função do coordenador', 'LISTA_SUSPENSA', 'S', '', 'Coordenador; Secretário; Diretor', 'S', 'N', '', '', '', '', '', ''],
      ['Identificação', 'Identificação', 'fonte_renda', 'Principal fonte de renda do município', 'LISTA_SUSPENSA', 'S', '', 'Agropecuária; Indústria; Comércio; Serviços; Turismo', 'S', 'N', '', '', '', '', '', ''],
      // Página 2 — condicional + grupo controlado por quantidade
      ['Coordenador e cursos', 'Cursos', 'qtd_cursos', 'Quantos cursos a COMPDEC realizou?', 'NUMERO', 'S', '', '', '', '', '', '', '', '', 0, ''],
      ['Coordenador e cursos', 'Cursos', 'cursos', 'Cursos realizados', 'GRUPO', 'N', 'Um registro por curso', '', '', '', '', '', '', 'qtd_cursos', '', ''],
      ['Coordenador e cursos', 'Cursos', 'curso_nome', 'Nome do curso', 'TEXTO_CURTO', 'S', '', '', '', '', '', '', 'cursos', '', '', ''],
      ['Coordenador e cursos', 'Cursos', 'curso_ano', 'Ano', 'ANO', 'S', '', '', '', '', '', '', 'cursos', '', '', ''],
      ['Coordenador e cursos', 'Cursos', 'curso_carga', 'Carga horária', 'NUMERO', 'N', '', '', '', '', '', '', 'cursos', '', 0, ''],
      // Página 3 — Sim/Não que abre campo condicional
      ['Estrutura', 'Portaria', 'tem_portaria', 'Há nomeação por Portaria?', 'SIM_NAO', 'S', '', '', '', '', '', '', '', '', '', ''],
      ['Estrutura', 'Portaria', 'portaria_ano', 'Ano da Portaria', 'ANO', 'S', 'Aparece só se houver Portaria', '', '', '', 'tem_portaria', 'true', '', '', '', ''],
    ];
    for (const linha of exemplos) ws.addRow(linha);

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
