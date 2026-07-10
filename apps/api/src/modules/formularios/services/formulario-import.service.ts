import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  AcaoCondicional,
  FonteAutomatica,
  OperadorCondicional,
  TipoPergunta,
  VarianteInformativo,
  type PaginaFormulario,
  type Pergunta,
  type SchemaFormulario,
  type SecaoFormulario,
} from '@dcmg/contracts';

/** Resumo exibido no preview (contagens do que será criado). */
export interface ResumoImportacao {
  secoes: number;
  perguntas: number;
  listas: number;
  regras: number;
}

/** Resultado do parse: schema nativo + resumo + erros amigáveis (por aba). */
export interface ResultadoImportacao {
  nome: string;
  schema: SchemaFormulario;
  resumo: ResumoImportacao;
  erros: string[];
}

const ABA_LISTAS = 'listas_suspensas';
const VALOR_OUTRO = 'outro';
/** Marcadores de pergunta-filha (dependência) no início do rótulo. */
const MARCADORES_FILHA = ['↳', '->', '→', '⤷', '↦'];
/** Marcadores de item de checklist no início do rótulo. */
const MARCADORES_CHECK = ['☐', '☑', '☒', '[ ]', '[]', '[x]'];

/**
 * Importa um formulário NATIVO a partir de uma planilha Excel no layout da
 * Defesa Civil MG. A planilha é apenas MOLDE: após a importação nada dela
 * permanece — o formulário vive no banco e é editável pelo construtor visual.
 *
 * Layout esperado:
 *  - cada ABA (worksheet) vira uma SEÇÃO (ordem preservada); a aba
 *    `Listas_Suspensas` é reservada para as opções dos selects;
 *  - colunas `Pergunta` e `Tipo` (a coluna `Resposta`, se existir, é ignorada);
 *  - a coluna `Tipo` mapeia para o tipo de campo (ver `mapearTipo`);
 *  - linhas iniciadas por `↳` são perguntas-filhas (condicionais) da anterior;
 *  - linhas iniciadas por `☐` viram um grupo repetível de itens;
 *  - linhas sem tipo (ou "Título/Instrução/...") viram componentes informativos.
 */
@Injectable()
export class FormularioImportService {
  // ── Normalização ─────────────────────────────────────────────────────────

  private celStr(cell: ExcelJS.Cell | undefined): string {
    if (!cell) return '';
    const v = cell.value;
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') {
      const o = v as { result?: unknown; richText?: { text: string }[]; text?: string };
      if (o.richText) return o.richText.map((r) => r.text).join('').trim();
      if (o.text !== undefined) return String(o.text).trim();
      if (o.result !== undefined) return String(o.result).trim();
      return '';
    }
    return String(v).trim();
  }

  /** minúsculas, sem acentos, espaços colapsados — para comparações. */
  private norm(s: string): string {
    return s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** slug estável para `codigo`/valor de opção. */
  private slug(s: string): string {
    const base = this.norm(s)
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60);
    return base || 'campo';
  }

  private codigoUnico(base: string, usados: Set<string>): string {
    let cod = this.slug(base);
    let i = 2;
    while (usados.has(cod)) cod = `${this.slug(base)}_${i++}`;
    usados.add(cod);
    return cod;
  }

  // ── Mapeamento de tipo ─────────────────────────────────────────────────────

  /**
   * Interpreta a coluna "Tipo". Retorna a configuração da pergunta, ou `null`
   * quando o tipo é desconhecido (vira erro amigável com a localização).
   */
  private mapearTipo(
    tipoRaw: string,
  ):
    | {
        tipo: TipoPergunta;
        opcoesFixas?: { valor: string; rotulo: string }[];
        variante?: VarianteInformativo;
        usaLista?: boolean;
      }
    | null {
    const t = this.norm(tipoRaw);

    if (t === '' ) return { tipo: TipoPergunta.INFORMATIVO, variante: VarianteInformativo.DESCRICAO };
    if (['titulo', 'subtitulo', 'cabecalho'].includes(t)) {
      return { tipo: TipoPergunta.INFORMATIVO, variante: VarianteInformativo.TITULO };
    }
    if (['instrucao', 'observacao', 'descricao', 'texto de apoio', 'nota'].includes(t)) {
      return { tipo: TipoPergunta.INFORMATIVO, variante: VarianteInformativo.DESCRICAO };
    }
    if (['alerta', 'aviso', 'atencao'].includes(t)) {
      return { tipo: TipoPergunta.INFORMATIVO, variante: VarianteInformativo.ALERTA };
    }
    if (['texto', 'texto curto'].includes(t)) return { tipo: TipoPergunta.TEXTO_CURTO };
    if (['texto longo', 'textarea', 'paragrafo', 'paragrafo longo'].includes(t)) {
      return { tipo: TipoPergunta.TEXTO_LONGO };
    }
    if (['numero', 'numerico', 'inteiro', 'quantidade'].includes(t)) return { tipo: TipoPergunta.NUMERO };
    if (t === 'data') return { tipo: TipoPergunta.DATA };
    if (t === 'hora') return { tipo: TipoPergunta.HORA };
    if (t === 'ano') return { tipo: TipoPergunta.ANO };
    if (['mes/ano', 'mes / ano', 'mes ano', 'competencia'].includes(t)) return { tipo: TipoPergunta.MES_ANO };
    if (['email', 'e-mail'].includes(t)) return { tipo: TipoPergunta.EMAIL };
    if (t === 'telefone') return { tipo: TipoPergunta.TELEFONE };
    if (t === 'cpf') return { tipo: TipoPergunta.CPF };
    if (t === 'cnpj') return { tipo: TipoPergunta.CNPJ };
    if (t === 'cep') return { tipo: TipoPergunta.CEP };
    if (['url', 'link'].includes(t)) return { tipo: TipoPergunta.URL };
    if (['municipio', 'municipio (ibge)', 'cidade'].includes(t)) return { tipo: TipoPergunta.MUNICIPIO };
    if (['upload', 'arquivo', 'anexo'].includes(t)) return { tipo: TipoPergunta.UPLOAD };
    if (['automatico', 'auto', 'somente leitura'].includes(t)) return { tipo: TipoPergunta.AUTOMATICO };

    if (t.startsWith('sim') && t.includes('n')) {
      // "Sim / Não" e "Sim / Não / N.A." → RADIO com 2 ou 3 opções.
      const opcoes = [
        { valor: 'sim', rotulo: 'Sim' },
        { valor: 'nao', rotulo: 'Não' },
      ];
      if (t.includes('n.a') || t.includes('na') || t.includes('nao se aplica')) {
        opcoes.push({ valor: 'nao_se_aplica', rotulo: 'Não se aplica' });
      }
      return { tipo: TipoPergunta.RADIO, opcoesFixas: opcoes };
    }
    if (['lista suspensa', 'lista', 'select', 'selecao', 'dropdown'].includes(t)) {
      return { tipo: TipoPergunta.LISTA_SUSPENSA, usaLista: true };
    }

    return null;
  }

  /** Infere a fonte de um campo AUTOMATICO a partir do rótulo. */
  private inferirFonte(rotulo: string): FonteAutomatica {
    const r = this.norm(rotulo);
    if (r.includes('ibge')) return FonteAutomatica.CODIGO_IBGE;
    if (r.includes('municipio') || r.includes('cidade')) return FonteAutomatica.MUNICIPIO_ATUAL;
    if (r.includes('usuario') || r.includes('responsavel pelo preenchimento')) return FonteAutomatica.USUARIO_ATUAL;
    if (r.includes('competencia')) return FonteAutomatica.COMPETENCIA_ATUAL;
    if (r.includes('protocolo')) return FonteAutomatica.PROTOCOLO;
    if (r.includes('ano')) return FonteAutomatica.ANO_ATUAL;
    if (r.includes('data')) return FonteAutomatica.DATA_ATUAL;
    return FonteAutomatica.CODIGO_IBGE;
  }

  // ── Listas suspensas ─────────────────────────────────────────────────────

  /**
   * Lê a aba `Listas_Suspensas`: cada COLUNA é uma lista; a 1ª linha é o nome
   * da lista, as células abaixo são as opções. Retorna Map(nomeNormalizado →
   * { nome, opcoes[] }).
   */
  private lerListas(wb: ExcelJS.Workbook): Map<string, { nome: string; opcoes: string[] }> {
    const mapa = new Map<string, { nome: string; opcoes: string[] }>();
    const ws = wb.worksheets.find((w) => this.norm(w.name) === ABA_LISTAS);
    if (!ws) return mapa;

    const header = ws.getRow(1);
    const colunas: { col: number; nome: string }[] = [];
    header.eachCell((cell, col) => {
      const nome = this.celStr(cell);
      if (nome) colunas.push({ col, nome });
    });

    for (const { col, nome } of colunas) {
      const opcoes: string[] = [];
      for (let r = 2; r <= ws.rowCount; r++) {
        const v = this.celStr(ws.getRow(r).getCell(col));
        if (v) opcoes.push(v);
      }
      if (opcoes.length) mapa.set(this.norm(nome), { nome, opcoes });
    }
    return mapa;
  }

  // ── Parse principal ────────────────────────────────────────────────────────

  async parsear(buffer: Buffer): Promise<ResultadoImportacao> {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    } catch {
      throw new BadRequestException('Não foi possível ler o arquivo. Envie uma planilha .xlsx válida.');
    }

    const erros: string[] = [];
    const listas = this.lerListas(wb);
    const listasUsadas = new Set<string>();
    const codigosUsados = new Set<string>();

    // Abas reservadas (não viram seção): listas e instruções.
    const abasSecao = wb.worksheets.filter((w) => {
      const n = this.norm(w.name);
      return n !== ABA_LISTAS && !n.startsWith('instruc');
    });
    if (abasSecao.length === 0) {
      throw new BadRequestException(
        'Nenhuma aba de seção encontrada. Cada aba (exceto "Listas_Suspensas") vira uma seção do formulário.',
      );
    }

    const paginas: PaginaFormulario[] = [];

    for (const ws of abasSecao) {
      const secao = this.parsearAba(ws, listas, listasUsadas, codigosUsados, erros);
      if (!secao) continue;
      // Cada aba = uma página com uma seção (mantém o padrão página→seção).
      paginas.push({ titulo: secao.titulo, secoes: [secao] });
    }

    if (paginas.length === 0) {
      throw new BadRequestException(
        'Nenhuma pergunta reconhecida na planilha. Verifique se há uma coluna "Pergunta" e uma coluna "Tipo".',
      );
    }

    const nome = this.nomeFormulario(wb);
    const schema: SchemaFormulario = { versao: 1, titulo: nome, paginas };
    const resumo = this.resumir(schema, listasUsadas.size);
    return { nome, schema, resumo, erros };
  }

  /** Nome do formulário: célula B1 da aba `Instrucoes`, ou padrão. */
  private nomeFormulario(wb: ExcelJS.Workbook): string {
    const instr = wb.worksheets.find((w) => this.norm(w.name).startsWith('instruc'));
    if (instr) {
      const b1 = this.celStr(instr.getCell('B1'));
      if (b1) return b1;
    }
    return 'Caracterização Municipal da COMPDEC';
  }

  /** Localiza a linha de cabeçalho (com "Pergunta" e "Tipo") numa aba. */
  private acharCabecalho(ws: ExcelJS.Worksheet): { linha: number; colPergunta: number; colTipo: number } | null {
    const limite = Math.min(ws.rowCount, 8);
    for (let r = 1; r <= limite; r++) {
      let colPergunta = 0;
      let colTipo = 0;
      ws.getRow(r).eachCell((cell, col) => {
        const n = this.norm(this.celStr(cell));
        if (n === 'pergunta' || n === 'perguntas' || n === 'campo') colPergunta = col;
        if (n === 'tipo' || n === 'tipo de resposta' || n === 'tipo de campo') colTipo = col;
      });
      if (colPergunta && colTipo) return { linha: r, colPergunta, colTipo };
    }
    return null;
  }

  /** Converte uma aba num SecaoFormulario. */
  private parsearAba(
    ws: ExcelJS.Worksheet,
    listas: Map<string, { nome: string; opcoes: string[] }>,
    listasUsadas: Set<string>,
    codigosUsados: Set<string>,
    erros: string[],
  ): SecaoFormulario | null {
    const cab = this.acharCabecalho(ws);
    const titulo = ws.name.replace(/^\s*\d+\s*[-.)]\s*/, '').trim() || ws.name;
    if (!cab) {
      erros.push(`Aba "${ws.name}": não achei as colunas "Pergunta" e "Tipo" — seção ignorada.`);
      return null;
    }

    const ehEfetivo = /efetiv/.test(this.norm(ws.name));
    const perguntas: Pergunta[] = [];
    const itensChecklist: string[] = [];
    let grupoChecklist: Pergunta | null = null;
    let ultimaTopLevel: Pergunta | null = null;

    for (let r = cab.linha + 1; r <= ws.rowCount; r++) {
      const rotuloBruto = this.celStr(ws.getRow(r).getCell(cab.colPergunta));
      const tipoRaw = this.celStr(ws.getRow(r).getCell(cab.colTipo));
      if (!rotuloBruto && !tipoRaw) continue; // linha vazia

      // Checklist: agrupa todos os itens da aba num único grupo genérico.
      const marcadorCheck = MARCADORES_CHECK.find((m) => rotuloBruto.startsWith(m));
      if (marcadorCheck) {
        const nomeItem = rotuloBruto.slice(marcadorCheck.length).trim();
        if (nomeItem) itensChecklist.push(nomeItem);
        if (!grupoChecklist) {
          grupoChecklist = this.criarGrupoChecklist(codigosUsados);
          perguntas.push(grupoChecklist);
        }
        continue;
      }

      // Filha (dependência): remove o marcador e vira condicional da anterior.
      const marcadorFilha = MARCADORES_FILHA.find((m) => rotuloBruto.startsWith(m));
      const ehFilha = !!marcadorFilha;
      const rotulo = ehFilha ? rotuloBruto.slice(marcadorFilha!.length).trim() : rotuloBruto;
      if (!rotulo) continue;

      const mapeado = this.mapearTipo(tipoRaw);
      if (!mapeado) {
        erros.push(`Aba "${ws.name}", pergunta "${rotulo}": tipo "${tipoRaw}" não reconhecido.`);
        continue;
      }

      const pergunta = this.criarPergunta(rotulo, mapeado, listas, listasUsadas, codigosUsados, erros, ws.name);

      // Dependência: mostra quando a pergunta anterior == "sim" (Sim/Não) ou
      // == primeira opção. Heurística — ajustável no builder.
      if (ehFilha && ultimaTopLevel) {
        const valorGatilho = this.valorGatilho(ultimaTopLevel);
        pergunta.regras = [
          {
            origemCodigo: ultimaTopLevel.codigo,
            operador: OperadorCondicional.IGUAL,
            valor: valorGatilho,
            acao: AcaoCondicional.MOSTRAR,
          },
        ];
      }

      perguntas.push(pergunta);
      if (!ehFilha && mapeado.tipo !== TipoPergunta.INFORMATIVO) ultimaTopLevel = pergunta;
    }

    if (grupoChecklist && itensChecklist.length) {
      grupoChecklist.ajuda = `Itens sugeridos na planilha: ${itensChecklist.join(', ')}.`;
    }

    // Seção EFETIVO: vira um único grupo repetível (um registro por servidor).
    if (ehEfetivo) {
      return this.envolverComoEfetivo(titulo, perguntas, codigosUsados);
    }

    return { titulo, perguntas };
  }

  /** Valor que dispara a exibição de uma pergunta-filha da `origem`. */
  private valorGatilho(origem: Pergunta): string {
    if (origem.tipo === TipoPergunta.SIM_NAO) return 'true';
    const primeira = origem.opcoes?.[0]?.valor;
    // Sim/Não vira RADIO com opção "sim".
    if (origem.opcoes?.some((o) => o.valor === 'sim')) return 'sim';
    return primeira ?? 'sim';
  }

  private criarGrupoChecklist(codigosUsados: Set<string>): Pergunta {
    const cod = this.codigoUnico('equipamentos', codigosUsados);
    return {
      codigo: cod,
      rotulo: 'Equipamentos / itens',
      tipo: TipoPergunta.GRUPO,
      obrigatorio: false,
      minInstancias: 0,
      perguntas: [
        { codigo: this.codigoUnico('item_nome', codigosUsados), rotulo: 'Item', tipo: TipoPergunta.TEXTO_CURTO, obrigatorio: true },
        { codigo: this.codigoUnico('item_possui', codigosUsados), rotulo: 'Possui?', tipo: TipoPergunta.SIM_NAO, obrigatorio: false },
        { codigo: this.codigoUnico('item_qtd', codigosUsados), rotulo: 'Quantidade', tipo: TipoPergunta.NUMERO, obrigatorio: false },
        { codigo: this.codigoUnico('item_obs', codigosUsados), rotulo: 'Observação', tipo: TipoPergunta.TEXTO_CURTO, obrigatorio: false },
      ],
    };
  }

  /** Cria a pergunta a partir do tipo mapeado, resolvendo opções/lista/fonte. */
  private criarPergunta(
    rotulo: string,
    mapeado: NonNullable<ReturnType<FormularioImportService['mapearTipo']>>,
    listas: Map<string, { nome: string; opcoes: string[] }>,
    listasUsadas: Set<string>,
    codigosUsados: Set<string>,
    erros: string[],
    nomeAba: string,
  ): Pergunta {
    const pergunta: Pergunta = {
      codigo: this.codigoUnico(rotulo, codigosUsados),
      rotulo,
      tipo: mapeado.tipo,
      obrigatorio: false,
    };

    if (mapeado.variante) pergunta.variante = mapeado.variante;

    if (mapeado.opcoesFixas) {
      pergunta.opcoes = mapeado.opcoesFixas;
    }

    if (mapeado.usaLista) {
      const lista = listas.get(this.norm(rotulo));
      if (lista) {
        pergunta.opcoes = lista.opcoes.map((rot) => ({ valor: this.slug(rot), rotulo: rot }));
        listasUsadas.add(this.norm(rotulo));
      } else {
        pergunta.opcoes = [{ valor: VALOR_OUTRO, rotulo: 'Outro(s)' }];
        erros.push(
          `Aba "${nomeAba}", "${rotulo}": lista suspensa sem correspondência na aba "Listas_Suspensas" — defina as opções no construtor.`,
        );
      }
    }

    if (mapeado.tipo === TipoPergunta.AUTOMATICO) {
      pergunta.fonteAutomatica = this.inferirFonte(rotulo);
    }

    return pergunta;
  }

  /** Envolve as perguntas-campo de uma seção EFETIVO num único grupo repetível. */
  private envolverComoEfetivo(
    titulo: string,
    perguntas: Pergunta[],
    codigosUsados: Set<string>,
  ): SecaoFormulario {
    const proibidosEmGrupo = [
      TipoPergunta.GRUPO,
      TipoPergunta.UPLOAD,
      TipoPergunta.AUTOMATICO,
      TipoPergunta.INFORMATIVO,
    ];
    const subperguntas = perguntas.filter((p) => !proibidosEmGrupo.includes(p.tipo));
    const foraDoGrupo = perguntas.filter((p) => proibidosEmGrupo.includes(p.tipo));

    const grupo: Pergunta = {
      codigo: this.codigoUnico('efetivo', codigosUsados),
      rotulo: titulo,
      tipo: TipoPergunta.GRUPO,
      obrigatorio: false,
      minInstancias: 0,
      ajuda: 'Adicione um registro por servidor/colaborador.',
      perguntas: subperguntas,
    };
    // Informativos/automáticos ficam antes do grupo; o grupo agrega os campos.
    return { titulo, perguntas: [...foraDoGrupo, grupo] };
  }

  private resumir(schema: SchemaFormulario, totalListas: number): ResumoImportacao {
    let secoes = 0;
    let perguntas = 0;
    let regras = 0;
    for (const pg of schema.paginas) {
      for (const s of pg.secoes) {
        secoes++;
        for (const p of s.perguntas) {
          if (p.tipo !== TipoPergunta.INFORMATIVO) perguntas++;
          regras += p.regras?.length ?? 0;
          for (const sub of p.perguntas ?? []) {
            perguntas++;
            regras += sub.regras?.length ?? 0;
          }
        }
      }
    }
    return { secoes, perguntas, listas: totalListas, regras };
  }

  // ── Geração da planilha-modelo (layout DCMG) ────────────────────────────────

  /** Gera um .xlsx de exemplo no layout DCMG (abas=seções + Listas_Suspensas). */
  async gerarModelo(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SIG Defesa Civil MG';

    const instr = wb.addWorksheet('Instrucoes');
    instr.getCell('A1').value = 'Nome do formulário:';
    instr.getCell('B1').value = 'Caracterização Municipal da COMPDEC';
    instr.getColumn(1).width = 26;
    instr.getColumn(2).width = 60;
    const legenda: [string, string][] = [
      ['Cada aba = uma seção', 'A ordem das abas é preservada. "Listas_Suspensas" é reservada.'],
      ['Colunas', 'Pergunta | Tipo | Resposta (a coluna Resposta é ignorada).'],
      ['Tipos', 'Texto, Texto longo, Número, Data, Hora, Sim / Não, Sim / Não / N.A., Lista suspensa, Município, Automático, Título, Instrução, Alerta.'],
      ['Lista suspensa', 'As opções vêm de uma coluna com o MESMO nome da pergunta na aba Listas_Suspensas.'],
      ['Pergunta-filha', 'Comece o rótulo com ↳ para depender da pergunta anterior (aparece quando = Sim).'],
      ['Checklist', 'Comece o rótulo com ☐ para gerar um grupo repetível de itens.'],
      ['Efetivo', 'Uma aba com "Efetivo" no nome vira um grupo repetível (um registro por servidor).'],
    ];
    instr.getCell('A3').value = 'Como preencher';
    instr.getCell('A3').font = { bold: true };
    legenda.forEach(([k, v], i) => {
      instr.getCell(`A${4 + i}`).value = k;
      instr.getCell(`B${4 + i}`).value = v;
    });

    const cab = ['Pergunta', 'Tipo', 'Resposta'];
    const secoes: [string, (string | number)[][]][] = [
      ['1- Identificacao do Municipio', [
        ['IDENTIFICAÇÃO', 'Título', ''],
        ['Município', 'Município', ''],
        ['Código IBGE', 'Automático', ''],
        ['Cargo/Função', 'Lista suspensa', ''],
        ['Principal fonte de renda', 'Lista suspensa', ''],
      ]],
      ['2- Estrutura da COMPDEC', [
        ['O município possui COMPDEC?', 'Sim / Não', ''],
        ['↳ Número da Lei', 'Texto', ''],
        ['↳ Ano da Lei', 'Ano', ''],
        ['Canal de atendimento à população', 'Lista suspensa', ''],
      ]],
      ['3- Efetivo', [
        ['Primeiro nome', 'Texto', ''],
        ['CPF', 'CPF', ''],
        ['Cargo', 'Texto', ''],
        ['Escolaridade', 'Lista suspensa', ''],
      ]],
      ['4- Infraestrutura', [
        ['Equipamentos disponíveis', 'Instrução', ''],
        ['☐ Drone', 'Sim / Não', ''],
        ['☐ Gerador', 'Sim / Não', ''],
        ['☐ Barco/Bote', 'Sim / Não', ''],
      ]],
    ];
    for (const [nome, linhas] of secoes) {
      const ws = wb.addWorksheet(nome);
      ws.addRow(cab);
      ws.getRow(1).font = { bold: true };
      ws.columns = [{ width: 44 }, { width: 20 }, { width: 24 }];
      for (const l of linhas) ws.addRow(l);
    }

    // Aba de listas: uma coluna por lista (cabeçalho = nome da pergunta).
    const listas = wb.addWorksheet('Listas_Suspensas');
    const colunas: [string, string[]][] = [
      ['Cargo/Função', ['Coordenador', 'Secretário', 'Diretor', 'Outro']],
      ['Principal fonte de renda', ['Agropecuária', 'Indústria', 'Comércio', 'Serviços', 'Turismo']],
      ['Canal de atendimento à população', ['Telefone', 'WhatsApp', 'Presencial', 'E-mail']],
      ['Escolaridade', ['Fundamental', 'Médio', 'Superior', 'Pós-graduação']],
    ];
    listas.getRow(1).values = colunas.map(([n]) => n);
    listas.getRow(1).font = { bold: true };
    colunas.forEach(([, opts], ci) => {
      listas.getColumn(ci + 1).width = 28;
      opts.forEach((o, ri) => {
        listas.getCell(ri + 2, ci + 1).value = o;
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
