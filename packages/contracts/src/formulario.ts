/**
 * Motor de formularios — contrato central.
 *
 * Define os tipos de campo suportados e a estrutura declarativa de um
 * formulario (campos, secoes e schema versionado). Esse contrato e
 * compartilhado entre o backend (validacao/persistencia) e o frontend
 * (renderizacao dinamica do formulario).
 */

/**
 * Tipos de campo suportados pelo motor de formularios.
 */
export enum TipoCampo {
  /** Texto livre. */
  TEXTO = 'TEXTO',
  /** Numero (inteiro ou decimal). */
  NUMERO = 'NUMERO',
  /** Data. */
  DATA = 'DATA',
  /** Selecao unica a partir de opcoes. */
  SELECT = 'SELECT',
  /** Selecao multipla a partir de opcoes. */
  MULTISELECT = 'MULTISELECT',
  /** Valor logico (sim/nao). */
  BOOLEANO = 'BOOLEANO',
  /** CPF (com validacao de digitos verificadores). */
  CPF = 'CPF',
  /** CNPJ (com validacao de digitos verificadores). */
  CNPJ = 'CNPJ',
  /** CEP. */
  CEP = 'CEP',
  /** Valor monetario (BRL). */
  MOEDA = 'MOEDA',
  /** Anexo de arquivo. */
  ARQUIVO = 'ARQUIVO',
}

/**
 * Opcao de um campo do tipo SELECT ou MULTISELECT.
 */
export interface OpcaoCampo {
  /** Valor persistido. */
  valor: string;
  /** Texto exibido ao usuario. */
  rotulo: string;
}

/**
 * Regras de validacao aplicaveis a um campo. Todos os atributos sao
 * opcionais; cada tipo de campo utiliza apenas os relevantes.
 */
export interface ValidacoesCampo {
  /** Tamanho minimo (texto) ou valor minimo (numero/moeda). */
  min?: number;
  /** Tamanho maximo (texto) ou valor maximo (numero/moeda). */
  max?: number;
  /** Expressao regular que o valor (texto) deve satisfazer. */
  padrao?: string;
  /** Tipos de arquivo aceitos (MIME), para campos ARQUIVO. */
  tiposArquivo?: string[];
  /** Tamanho maximo do arquivo em megabytes, para campos ARQUIVO. */
  tamanhoMaximoMb?: number;
  /** Mensagem de erro personalizada exibida quando a validacao falha. */
  mensagem?: string;
}

/**
 * Condicao que torna um campo visivel/obrigatorio apenas quando outro
 * campo possui determinado valor (logica condicional simples).
 */
export interface CondicaoCampo {
  /** Chave do campo de referencia. */
  campo: string;
  /** Valor (ou valores) que ativam a condicao. */
  igualA: string | number | boolean | Array<string | number | boolean>;
}

/**
 * Definicao de um campo do formulario.
 */
export interface CampoFormulario {
  /** Identificador estavel do campo dentro do schema. */
  chave: string;
  /** Rotulo exibido ao usuario. */
  rotulo: string;
  /** Tipo do campo. */
  tipo: TipoCampo;
  /** Indica se o preenchimento e obrigatorio. */
  obrigatorio: boolean;
  /** Texto de ajuda/dica exibido junto ao campo. */
  ajuda?: string;
  /** Regras de validacao adicionais. */
  validacoes?: ValidacoesCampo;
  /** Opcoes disponiveis (para SELECT/MULTISELECT). */
  opcoes?: OpcaoCampo[];
  /** Condicao que controla a exibicao do campo. */
  condicional?: CondicaoCampo;
}

/**
 * Agrupamento logico de campos dentro do formulario.
 */
export interface SecaoFormulario {
  /** Identificador estavel da secao. */
  chave: string;
  /** Titulo da secao. */
  titulo: string;
  /** Descricao opcional da secao. */
  descricao?: string;
  /** Campos pertencentes a secao. */
  campos: CampoFormulario[];
}

/**
 * Schema completo e versionado de um formulario.
 *
 * E o documento que descreve, de forma declarativa, toda a estrutura do
 * formulario que sera renderizada e validada dinamicamente.
 */
export interface SchemaFormulario {
  /** Versao do schema (para versionamento e migracao de respostas). */
  versao: number;
  /** Titulo do formulario. */
  titulo?: string;
  /** Descricao do formulario. */
  descricao?: string;
  /** Secoes que compoem o formulario. */
  secoes: SecaoFormulario[];
}
