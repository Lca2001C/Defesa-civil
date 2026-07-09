/**
 * Motor de formularios — contrato central (construtor visual).
 *
 * Define os tipos de pergunta suportados e a estrutura declarativa de um
 * formulario (perguntas, secoes, opcoes e regras condicionais). No banco a
 * estrutura e NORMALIZADA (tabelas Secao/Pergunta/OpcaoPergunta/RegraCondicional);
 * este contrato e a PROJECAO JSON usada no transporte, compartilhada entre o
 * construtor (edicao), o renderizador (preenchimento) e a validacao.
 */

/**
 * Tipos de pergunta suportados pelo construtor visual.
 */
export enum TipoPergunta {
  TEXTO_CURTO = 'TEXTO_CURTO',
  TEXTO_LONGO = 'TEXTO_LONGO',
  NUMERO = 'NUMERO',
  DATA = 'DATA',
  EMAIL = 'EMAIL',
  TELEFONE = 'TELEFONE',
  CPF = 'CPF',
  CNPJ = 'CNPJ',
  CEP = 'CEP',
  MOEDA = 'MOEDA',
  PORCENTAGEM = 'PORCENTAGEM',
  SIM_NAO = 'SIM_NAO',
  LISTA_SUSPENSA = 'LISTA_SUSPENSA',
  RADIO = 'RADIO',
  CHECKBOX = 'CHECKBOX',
  UPLOAD = 'UPLOAD',
  URL = 'URL',
  AUTOMATICO = 'AUTOMATICO',
  /** Ano com exatamente 4 digitos (ex.: 2026). Valor: string "AAAA". */
  ANO = 'ANO',
  /** Competencia mensal no formato MM/AAAA. Valor: string "MM/AAAA". */
  MES_ANO = 'MES_ANO',
  /**
   * Municipio da base oficial (IBGE), com autocomplete no preenchimento.
   * Valor: { id: number, nome: string } — o id e validado no servidor.
   */
  MUNICIPIO = 'MUNICIPIO',
  /**
   * Grupo repetivel de subperguntas (ex.: cadastro individual de cursos ou
   * do efetivo). O numero de instancias e controlado por outra pergunta
   * NUMERO (`quantidadeOrigemCodigo`) ou por `minInstancias`/`maxInstancias`.
   * Valor: array de objetos { [codigoSubpergunta]: valor }.
   */
  GRUPO = 'GRUPO',
}

/**
 * Fonte de preenchimento de uma pergunta AUTOMATICO (resolvida no servidor).
 */
export enum FonteAutomatica {
  CODIGO_IBGE = 'CODIGO_IBGE',
  MUNICIPIO_ATUAL = 'MUNICIPIO_ATUAL',
  USUARIO_ATUAL = 'USUARIO_ATUAL',
  DATA_ATUAL = 'DATA_ATUAL',
  ANO_ATUAL = 'ANO_ATUAL',
  COMPETENCIA_ATUAL = 'COMPETENCIA_ATUAL',
  PROTOCOLO = 'PROTOCOLO',
}

/** Operador de comparacao de uma regra condicional. */
export enum OperadorCondicional {
  IGUAL = 'IGUAL',
  DIFERENTE = 'DIFERENTE',
}

/** Acao aplicada a pergunta-alvo quando a condicao e satisfeita. */
export enum AcaoCondicional {
  MOSTRAR = 'MOSTRAR',
  OCULTAR = 'OCULTAR',
}

/** Opcao de uma pergunta LISTA_SUSPENSA, RADIO ou CHECKBOX. */
export interface OpcaoPergunta {
  /** Valor persistido. */
  valor: string;
  /** Texto exibido ao usuario. */
  rotulo: string;
  /** Ordem de exibicao (opcional). */
  ordem?: number;
}

/**
 * Regras de validacao de uma pergunta. Cada tipo usa apenas os campos relevantes.
 */
export interface ValidacoesPergunta {
  /** Tamanho minimo (texto) ou valor minimo (numero/moeda/porcentagem). */
  min?: number;
  /** Tamanho maximo (texto) ou valor maximo (numero/moeda/porcentagem). */
  max?: number;
  /** Expressao regular que o valor (texto) deve satisfazer. */
  padrao?: string;
  /** Tipos de arquivo aceitos (MIME/extensao), para UPLOAD. */
  tiposArquivo?: string[];
  /** Tamanho maximo do arquivo em MB, para UPLOAD. */
  tamanhoMaximoMb?: number;
  /** Mensagem de erro personalizada. */
  mensagem?: string;
}

/**
 * Regra condicional simples: quando a pergunta de `origemCodigo` satisfaz
 * (operador, valor), aplica `acao` sobre a pergunta que declara a regra.
 */
export interface RegraCondicional {
  /** Codigo da pergunta de referencia (origem). */
  origemCodigo: string;
  /** Operador de comparacao. */
  operador: OperadorCondicional;
  /** Valor comparado (string; o renderizador coage conforme o tipo). */
  valor: string;
  /** Acao sobre a pergunta-alvo. */
  acao: AcaoCondicional;
}

/**
 * Definicao de uma pergunta do formulario.
 */
export interface Pergunta {
  /** Identificador no banco (presente apenas em schemas carregados). */
  id?: string;
  /** Identificador estavel dentro do schema (chave das respostas). */
  codigo: string;
  /** Rotulo exibido ao usuario. */
  rotulo: string;
  /** Tipo da pergunta. */
  tipo: TipoPergunta;
  /** Indica se o preenchimento e obrigatorio. */
  obrigatorio: boolean;
  /** Texto de ajuda/dica. */
  ajuda?: string;
  /** Ordem dentro da secao. */
  ordem?: number;
  /** Regras de validacao. */
  validacoes?: ValidacoesPergunta;
  /** Opcoes (LISTA_SUSPENSA/RADIO/CHECKBOX). */
  opcoes?: OpcaoPergunta[];
  /** Regras condicionais que controlam a exibicao desta pergunta. */
  regras?: RegraCondicional[];
  /** Fonte de preenchimento, para tipo AUTOMATICO. */
  fonteAutomatica?: FonteAutomatica;
  /**
   * LISTA_SUSPENSA com selecao multipla (valor: string[] como o CHECKBOX).
   * Indicada para listas longas (ex.: COBRADE) onde checkboxes nao escalam.
   */
  multipla?: boolean;
  /** Subperguntas (apenas tipo GRUPO). Nao podem ser GRUPO/UPLOAD/AUTOMATICO. */
  perguntas?: Pergunta[];
  /**
   * Codigo de uma pergunta NUMERO (fora de grupos) que determina o numero
   * exato de instancias do grupo (ex.: "qtd_cursos" abre N blocos de curso).
   */
  quantidadeOrigemCodigo?: string;
  /** Minimo de instancias do grupo quando nao ha quantidadeOrigemCodigo. */
  minInstancias?: number;
  /** Maximo de instancias do grupo quando nao ha quantidadeOrigemCodigo. */
  maxInstancias?: number;
}

/**
 * Secao (agrupamento de perguntas) do formulario.
 */
export interface SecaoFormulario {
  /** Identificador no banco (presente apenas em schemas carregados). */
  id?: string;
  /** Titulo da secao. */
  titulo: string;
  /** Descricao opcional. */
  descricao?: string;
  /** Ordem da secao dentro da pagina. */
  ordem?: number;
  /** Perguntas pertencentes a secao. */
  perguntas: Pergunta[];
}

/**
 * Pagina (agrupamento de secoes) do formulario. Cada pagina e exibida como
 * um passo no preenchimento (navegacao Avancar/Voltar).
 */
export interface PaginaFormulario {
  /** Identificador no banco (presente apenas em schemas carregados). */
  id?: string;
  /** Titulo da pagina. */
  titulo: string;
  /** Descricao opcional. */
  descricao?: string;
  /** Ordem da pagina. */
  ordem?: number;
  /** Secoes que compoem a pagina. */
  secoes: SecaoFormulario[];
}

/**
 * Schema completo e versionado de um formulario (projecao JSON).
 *
 * O backend sempre devolve `paginas`. `secoes` permanece opcional apenas como
 * forma de ENTRADA legada (ex.: templates de seed sem paginas), embrulhada em
 * uma pagina default na decomposicao.
 */
export interface SchemaFormulario {
  /** Numero da versao. */
  versao: number;
  /** Titulo do formulario. */
  titulo?: string;
  /** Descricao do formulario. */
  descricao?: string;
  /** Paginas que compoem o formulario. */
  paginas: PaginaFormulario[];
  /** Entrada legada: secoes sem pagina (embrulhadas em "Pagina 1"). */
  secoes?: SecaoFormulario[];
}

/**
 * Conteudo de um bloco reutilizavel: uma secao parcial (titulo + perguntas)
 * que o construtor expande dentro de uma secao existente.
 */
export interface ConteudoBloco {
  titulo?: string;
  descricao?: string;
  perguntas: Pergunta[];
}
