import {
  AcaoCondicional,
  OperadorCondicional,
  TipoPergunta,
  type Pergunta,
  type SchemaFormulario,
} from './formulario';
import { campoVisivel, cpfValido, validarRespostas } from './validacao';

/** Helper: schema de uma pagina/secao com as perguntas dadas. */
function schemaCom(...perguntas: Pergunta[]): SchemaFormulario {
  return {
    versao: 1,
    paginas: [{ titulo: 'Pagina 1', secoes: [{ titulo: 'Secao 1', perguntas }] }],
  };
}

function pergunta(parcial: Partial<Pergunta> & Pick<Pergunta, 'codigo' | 'tipo'>): Pergunta {
  return { rotulo: parcial.codigo, obrigatorio: false, ...parcial };
}

/** Regra condicional "MOSTRAR quando origem == valor". */
function mostrarQuando(origemCodigo: string, valor: string) {
  return [
    {
      origemCodigo,
      operador: OperadorCondicional.IGUAL,
      valor,
      acao: AcaoCondicional.MOSTRAR,
    },
  ];
}

describe('validarRespostas — obrigatoriedade e visibilidade condicional', () => {
  it('acusa obrigatoria visivel ausente', () => {
    const schema = schemaCom(
      pergunta({ codigo: 'nome', tipo: TipoPergunta.TEXTO_CURTO, obrigatorio: true }),
    );
    const erros = validarRespostas(schema, {});
    expect(erros).toEqual([{ codigo: 'nome', mensagem: 'Campo obrigatorio.' }]);
  });

  it('NAO acusa obrigatoria OCULTA por condicional (Se Sim, abrir campo)', () => {
    const schema = schemaCom(
      pergunta({ codigo: 'tem_portaria', tipo: TipoPergunta.SIM_NAO, obrigatorio: true }),
      pergunta({
        codigo: 'ano_portaria',
        tipo: TipoPergunta.ANO,
        obrigatorio: true,
        regras: mostrarQuando('tem_portaria', 'true'),
      }),
    );
    // "Nao" -> ano_portaria oculto: nao deve exigir.
    expect(validarRespostas(schema, { tem_portaria: false })).toEqual([]);
    // "Sim" -> ano_portaria visivel e vazio: deve exigir.
    expect(validarRespostas(schema, { tem_portaria: true })).toEqual([
      { codigo: 'ano_portaria', mensagem: 'Campo obrigatorio.' },
    ]);
  });

  it('opcional vazio nao gera erro; preenchido invalido gera', () => {
    const schema = schemaCom(pergunta({ codigo: 'email', tipo: TipoPergunta.EMAIL }));
    expect(validarRespostas(schema, {})).toEqual([]);
    expect(validarRespostas(schema, { email: 'invalido' })).toEqual([
      { codigo: 'email', mensagem: 'E-mail invalido.' },
    ]);
  });
});

describe('validarRespostas — tipos ANO, MES_ANO e MUNICIPIO', () => {
  const schema = schemaCom(
    pergunta({ codigo: 'ano', tipo: TipoPergunta.ANO }),
    pergunta({ codigo: 'mes_ano', tipo: TipoPergunta.MES_ANO }),
    pergunta({ codigo: 'municipio', tipo: TipoPergunta.MUNICIPIO }),
  );

  it('ANO exige 4 digitos e faixa plausivel', () => {
    expect(validarRespostas(schema, { ano: '2026' })).toEqual([]);
    expect(validarRespostas(schema, { ano: '26' })).toHaveLength(1);
    expect(validarRespostas(schema, { ano: '1800' })).toHaveLength(1);
    expect(validarRespostas(schema, { ano: 'abcd' })).toHaveLength(1);
  });

  it('MES_ANO exige MM/AAAA com mes valido', () => {
    expect(validarRespostas(schema, { mes_ano: '07/2026' })).toEqual([]);
    expect(validarRespostas(schema, { mes_ano: '13/2026' })).toHaveLength(1);
    expect(validarRespostas(schema, { mes_ano: '2026-07' })).toHaveLength(1);
  });

  it('MUNICIPIO exige shape { id, nome }', () => {
    expect(validarRespostas(schema, { municipio: { id: 3106200, nome: 'Belo Horizonte' } })).toEqual([]);
    expect(validarRespostas(schema, { municipio: 'Belo Horizonte' })).toHaveLength(1);
    expect(validarRespostas(schema, { municipio: { id: -1, nome: 'X' } })).toHaveLength(1);
  });
});

describe('validarRespostas — opcoes de lista (incl. multipla)', () => {
  const opcoes = [
    { valor: 'a', rotulo: 'A' },
    { valor: 'b', rotulo: 'B' },
  ];

  it('rejeita opcao fora da lista (RADIO/LISTA_SUSPENSA)', () => {
    const schema = schemaCom(pergunta({ codigo: 'canal', tipo: TipoPergunta.LISTA_SUSPENSA, opcoes }));
    expect(validarRespostas(schema, { canal: 'a' })).toEqual([]);
    expect(validarRespostas(schema, { canal: 'z' })).toHaveLength(1);
  });

  it('LISTA_SUSPENSA multipla aceita array de opcoes validas', () => {
    const schema = schemaCom(
      pergunta({ codigo: 'cobrade', tipo: TipoPergunta.LISTA_SUSPENSA, multipla: true, opcoes }),
    );
    expect(validarRespostas(schema, { cobrade: ['a', 'b'] })).toEqual([]);
    expect(validarRespostas(schema, { cobrade: ['a', 'z'] })).toHaveLength(1);
    expect(validarRespostas(schema, { cobrade: 'a' })).toHaveLength(1); // esperava array
  });

  it('padrao "Outro(s)": companheira condicional obrigatoria exigida so quando selecionada', () => {
    // Convencao do builder: opcao `outro` + pergunta TEXTO obrigatoria com
    // regra MOSTRAR quando a origem == "outro".
    const schema = schemaCom(
      pergunta({
        codigo: 'cargo',
        tipo: TipoPergunta.LISTA_SUSPENSA,
        opcoes: [...opcoes, { valor: 'outro', rotulo: 'Outro(s)' }],
      }),
      pergunta({
        codigo: 'cargo_outro',
        tipo: TipoPergunta.TEXTO_CURTO,
        obrigatorio: true,
        regras: mostrarQuando('cargo', 'outro'),
      }),
    );
    expect(validarRespostas(schema, { cargo: 'a' })).toEqual([]);
    expect(validarRespostas(schema, { cargo: 'outro' })).toEqual([
      { codigo: 'cargo_outro', mensagem: 'Campo obrigatorio.' },
    ]);
    expect(validarRespostas(schema, { cargo: 'outro', cargo_outro: 'Secretario' })).toEqual([]);
  });
});

describe('validarRespostas — GRUPO repetivel', () => {
  const grupoCursos = pergunta({
    codigo: 'cursos',
    tipo: TipoPergunta.GRUPO,
    quantidadeOrigemCodigo: 'qtd_cursos',
    perguntas: [
      pergunta({ codigo: 'nome_curso', tipo: TipoPergunta.TEXTO_CURTO, obrigatorio: true }),
      pergunta({ codigo: 'ano_curso', tipo: TipoPergunta.ANO, obrigatorio: true }),
    ],
  });
  const schema = schemaCom(
    pergunta({ codigo: 'qtd_cursos', tipo: TipoPergunta.NUMERO }),
    grupoCursos,
  );

  it('exige exatamente N instancias quando controlado por quantidade', () => {
    const erros = validarRespostas(schema, { qtd_cursos: 2, cursos: [{ nome_curso: 'X', ano_curso: '2024' }] });
    expect(erros).toEqual([
      { codigo: 'cursos', mensagem: 'Preencha 2 registro(s) — foram informados 1.' },
    ]);
  });

  it('valida subperguntas por instancia com indice no erro', () => {
    const erros = validarRespostas(schema, {
      qtd_cursos: 2,
      cursos: [
        { nome_curso: 'Capacitacao', ano_curso: '2024' },
        { nome_curso: '', ano_curso: '24' },
      ],
    });
    expect(erros).toEqual([
      { codigo: 'nome_curso', instancia: 1, mensagem: 'Campo obrigatorio.' },
      { codigo: 'ano_curso', instancia: 1, mensagem: 'Informe um ano com 4 digitos.' },
    ]);
  });

  it('aceita grupo completo e valido', () => {
    const erros = validarRespostas(schema, {
      qtd_cursos: 1,
      cursos: [{ nome_curso: 'Capacitacao', ano_curso: '2024' }],
    });
    expect(erros).toEqual([]);
  });

  it('min/max de instancias quando nao ha quantidade controladora', () => {
    const schemaMinMax = schemaCom(
      pergunta({
        codigo: 'consorciados',
        tipo: TipoPergunta.GRUPO,
        minInstancias: 1,
        maxInstancias: 2,
        perguntas: [pergunta({ codigo: 'mun', tipo: TipoPergunta.TEXTO_CURTO, obrigatorio: true })],
      }),
    );
    expect(validarRespostas(schemaMinMax, { consorciados: [] })).toHaveLength(1);
    expect(validarRespostas(schemaMinMax, { consorciados: [{ mun: 'A' }, { mun: 'B' }, { mun: 'C' }] })).toHaveLength(1);
    expect(validarRespostas(schemaMinMax, { consorciados: [{ mun: 'A' }] })).toEqual([]);
  });

  it('subpergunta condicional dentro da instancia (cedido -> orgao)', () => {
    const grupoEfetivo = pergunta({
      codigo: 'efetivo',
      tipo: TipoPergunta.GRUPO,
      minInstancias: 1,
      perguntas: [
        pergunta({ codigo: 'cedido', tipo: TipoPergunta.SIM_NAO, obrigatorio: true }),
        pergunta({
          codigo: 'orgao_origem',
          tipo: TipoPergunta.TEXTO_CURTO,
          obrigatorio: true,
          regras: mostrarQuando('cedido', 'true'),
        }),
      ],
    });
    const s = schemaCom(grupoEfetivo);
    expect(validarRespostas(s, { efetivo: [{ cedido: false }] })).toEqual([]);
    expect(validarRespostas(s, { efetivo: [{ cedido: true }] })).toEqual([
      { codigo: 'orgao_origem', instancia: 0, mensagem: 'Campo obrigatorio.' },
    ]);
  });
});

describe('campoVisivel e cpfValido (regressao da logica movida do web)', () => {
  it('campoVisivel compara boolean/array/string', () => {
    const campo = pergunta({
      codigo: 'x',
      tipo: TipoPergunta.TEXTO_CURTO,
      regras: mostrarQuando('origem', 'true'),
    });
    expect(campoVisivel(campo, { origem: true })).toBe(true);
    expect(campoVisivel(campo, { origem: false })).toBe(false);
    expect(campoVisivel(campo, {})).toBe(false);
  });

  it('cpfValido valida digitos verificadores', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cpfValido('123')).toBe(false);
  });
});
