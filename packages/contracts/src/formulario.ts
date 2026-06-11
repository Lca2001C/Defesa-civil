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
  /** Ordem da secao. */
  ordem?: number;
  /** Perguntas pertencentes a secao. */
  perguntas: Pergunta[];
}

/**
 * Schema completo e versionado de um formulario (projecao JSON).
 */
export interface SchemaFormulario {
  /** Numero da versao. */
  versao: number;
  /** Titulo do formulario. */
  titulo?: string;
  /** Descricao do formulario. */
  descricao?: string;
  /** Secoes que compoem o formulario. */
  secoes: SecaoFormulario[];
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
