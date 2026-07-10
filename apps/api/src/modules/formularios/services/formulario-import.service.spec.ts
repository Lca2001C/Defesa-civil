import * as ExcelJS from 'exceljs';
import { TipoPergunta, VarianteInformativo } from '@dcmg/contracts';
import { FormularioImportService } from './formulario-import.service';

/** Monta um .xlsx multi-aba (layout DCMG) em memória para testar o parser. */
async function montarXlsx(
  abas: { nome: string; linhas: (string | number)[][] }[],
  opcoes?: { listas?: [string, string[]][]; nome?: string },
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  if (opcoes?.nome) {
    const instr = wb.addWorksheet('Instrucoes');
    instr.getCell('A1').value = 'Nome:';
    instr.getCell('B1').value = opcoes.nome;
  }
  for (const aba of abas) {
    const ws = wb.addWorksheet(aba.nome);
    ws.addRow(['Pergunta', 'Tipo', 'Resposta']);
    for (const l of aba.linhas) ws.addRow(l);
  }
  if (opcoes?.listas) {
    const ws = wb.addWorksheet('Listas_Suspensas');
    ws.getRow(1).values = opcoes.listas.map(([n]) => n);
    opcoes.listas.forEach(([, opts], ci) => {
      opts.forEach((o, ri) => {
        ws.getCell(ri + 2, ci + 1).value = o;
      });
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

const svc = new FormularioImportService();

describe('FormularioImportService — parsear (layout DCMG)', () => {
  it('cada aba vira uma seção, na ordem; título vira INFORMATIVO', async () => {
    const buffer = await montarXlsx(
      [
        {
          nome: '1- Identificacao',
          linhas: [
            ['IDENTIFICAÇÃO', 'Título', ''],
            ['Município', 'Município', ''],
            ['Código IBGE', 'Automático', ''],
            ['Cargo/Função', 'Lista suspensa', ''],
          ],
        },
        {
          nome: '2- Estrutura',
          linhas: [
            ['Possui COMPDEC?', 'Sim / Não', ''],
            ['↳ Ano da Lei', 'Ano', ''],
          ],
        },
      ],
      { listas: [['Cargo/Função', ['Coordenador', 'Diretor']]], nome: 'Form DCMG' },
    );

    const { nome, schema, resumo, erros } = await svc.parsear(buffer);

    expect(nome).toBe('Form DCMG');
    expect(erros).toEqual([]);
    expect(schema.paginas).toHaveLength(2);
    expect(schema.paginas[0]!.secoes[0]!.titulo).toBe('Identificacao');
    expect(schema.paginas[1]!.secoes[0]!.titulo).toBe('Estrutura');

    const p1 = schema.paginas[0]!.secoes[0]!.perguntas;
    const titulo = p1[0]!;
    expect(titulo.tipo).toBe(TipoPergunta.INFORMATIVO);
    expect(titulo.variante).toBe(VarianteInformativo.TITULO);

    const municipio = p1.find((p) => p.rotulo === 'Município')!;
    expect(municipio.tipo).toBe(TipoPergunta.MUNICIPIO);

    const ibge = p1.find((p) => p.rotulo === 'Código IBGE')!;
    expect(ibge.tipo).toBe(TipoPergunta.AUTOMATICO);
    expect(ibge.fonteAutomatica).toBe('CODIGO_IBGE');

    const cargo = p1.find((p) => p.rotulo === 'Cargo/Função')!;
    expect(cargo.tipo).toBe(TipoPergunta.LISTA_SUSPENSA);
    expect(cargo.opcoes?.map((o) => o.rotulo)).toEqual(['Coordenador', 'Diretor']);

    // Pergunta-filha vira condicional da anterior (Sim/Não → RADIO com "sim").
    const p2 = schema.paginas[1]!.secoes[0]!.perguntas;
    const possui = p2.find((p) => p.rotulo === 'Possui COMPDEC?')!;
    expect(possui.tipo).toBe(TipoPergunta.RADIO);
    const filha = p2.find((p) => p.rotulo === 'Ano da Lei')!;
    expect(filha.regras?.[0]).toMatchObject({ origemCodigo: possui.codigo, valor: 'sim' });

    expect(resumo.secoes).toBe(2);
    expect(resumo.listas).toBe(1);
    expect(resumo.regras).toBe(1);
  });

  it('Sim / Não / N.A. vira RADIO com 3 opções', async () => {
    const buffer = await montarXlsx([
      { nome: 'S', linhas: [['Tem PLANCON?', 'Sim / Não / N.A.', '']] },
    ]);
    const { schema } = await svc.parsear(buffer);
    const p = schema.paginas[0]!.secoes[0]!.perguntas[0]!;
    expect(p.tipo).toBe(TipoPergunta.RADIO);
    expect(p.opcoes?.map((o) => o.valor)).toEqual(['sim', 'nao', 'nao_se_aplica']);
  });

  it('linhas ☐ viram um grupo repetível de itens', async () => {
    const buffer = await montarXlsx([
      {
        nome: 'Infraestrutura',
        linhas: [
          ['Equipamentos', 'Instrução', ''],
          ['☐ Drone', 'Sim / Não', ''],
          ['☐ Gerador', 'Sim / Não', ''],
        ],
      },
    ]);
    const { schema } = await svc.parsear(buffer);
    const perguntas = schema.paginas[0]!.secoes[0]!.perguntas;
    const grupo = perguntas.find((p) => p.tipo === TipoPergunta.GRUPO)!;
    expect(grupo).toBeDefined();
    expect(grupo.perguntas?.map((s) => s.rotulo)).toEqual(['Item', 'Possui?', 'Quantidade', 'Observação']);
    expect(grupo.ajuda).toContain('Drone');
  });

  it('aba com "Efetivo" no nome vira um grupo repetível único', async () => {
    const buffer = await montarXlsx([
      {
        nome: '3- Efetivo',
        linhas: [
          ['Primeiro nome', 'Texto', ''],
          ['CPF', 'CPF', ''],
          ['Cargo', 'Texto', ''],
        ],
      },
    ]);
    const { schema } = await svc.parsear(buffer);
    const perguntas = schema.paginas[0]!.secoes[0]!.perguntas;
    expect(perguntas).toHaveLength(1);
    expect(perguntas[0]!.tipo).toBe(TipoPergunta.GRUPO);
    expect(perguntas[0]!.perguntas?.map((s) => s.rotulo)).toEqual(['Primeiro nome', 'CPF', 'Cargo']);
  });

  it('reporta tipo desconhecido como erro amigável (sem quebrar)', async () => {
    const buffer = await montarXlsx([
      { nome: 'S', linhas: [['Campo estranho', 'Coisa Invalida', '']] },
    ]);
    const { erros } = await svc.parsear(buffer);
    expect(erros.some((e) => e.includes('não reconhecido'))).toBe(true);
  });

  it('lista suspensa sem correspondência gera erro amigável', async () => {
    const buffer = await montarXlsx([
      { nome: 'S', linhas: [['Sem lista', 'Lista suspensa', '']] },
    ]);
    const { erros } = await svc.parsear(buffer);
    expect(erros.some((e) => e.includes('sem correspondência'))).toBe(true);
  });
});

describe('FormularioImportService — gerarModelo', () => {
  it('gera um .xlsx cujo próprio modelo é reimportável sem erros', async () => {
    const modelo = await svc.gerarModelo();
    expect(modelo.length).toBeGreaterThan(0);
    const { schema, erros } = await svc.parsear(modelo);
    expect(schema.paginas.length).toBeGreaterThanOrEqual(4);
    expect(erros).toEqual([]);
  });
});
