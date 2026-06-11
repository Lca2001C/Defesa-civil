// Metadados e fábricas para o construtor visual de formulários.
import {
  FonteAutomatica,
  TipoPergunta,
  type Pergunta,
  type SecaoFormulario,
} from "@dcmg/contracts";

export interface TipoInfo {
  tipo: TipoPergunta;
  rotulo: string;
  grupo: "Texto" | "Número" | "Escolha" | "Especial";
}

/** Catálogo dos 18 tipos de pergunta, agrupados para a paleta. */
export const TIPOS: TipoInfo[] = [
  { tipo: TipoPergunta.TEXTO_CURTO, rotulo: "Texto curto", grupo: "Texto" },
  { tipo: TipoPergunta.TEXTO_LONGO, rotulo: "Texto longo", grupo: "Texto" },
  { tipo: TipoPergunta.EMAIL, rotulo: "E-mail", grupo: "Texto" },
  { tipo: TipoPergunta.TELEFONE, rotulo: "Telefone", grupo: "Texto" },
  { tipo: TipoPergunta.CPF, rotulo: "CPF", grupo: "Texto" },
  { tipo: TipoPergunta.CNPJ, rotulo: "CNPJ", grupo: "Texto" },
  { tipo: TipoPergunta.CEP, rotulo: "CEP", grupo: "Texto" },
  { tipo: TipoPergunta.URL, rotulo: "URL/Link", grupo: "Texto" },
  { tipo: TipoPergunta.NUMERO, rotulo: "Número", grupo: "Número" },
  { tipo: TipoPergunta.MOEDA, rotulo: "Moeda (R$)", grupo: "Número" },
  { tipo: TipoPergunta.PORCENTAGEM, rotulo: "Porcentagem", grupo: "Número" },
  { tipo: TipoPergunta.DATA, rotulo: "Data", grupo: "Número" },
  { tipo: TipoPergunta.SIM_NAO, rotulo: "Sim/Não", grupo: "Escolha" },
  { tipo: TipoPergunta.LISTA_SUSPENSA, rotulo: "Lista suspensa", grupo: "Escolha" },
  { tipo: TipoPergunta.RADIO, rotulo: "Escolha única", grupo: "Escolha" },
  { tipo: TipoPergunta.CHECKBOX, rotulo: "Múltipla escolha", grupo: "Escolha" },
  { tipo: TipoPergunta.UPLOAD, rotulo: "Upload de arquivo", grupo: "Especial" },
  { tipo: TipoPergunta.AUTOMATICO, rotulo: "Automático", grupo: "Especial" },
];

export const ROTULO_TIPO: Record<TipoPergunta, string> = Object.fromEntries(
  TIPOS.map((t) => [t.tipo, t.rotulo]),
) as Record<TipoPergunta, string>;

export const FONTES_AUTOMATICAS: { fonte: FonteAutomatica; rotulo: string }[] = [
  { fonte: FonteAutomatica.CODIGO_IBGE, rotulo: "Código IBGE" },
  { fonte: FonteAutomatica.MUNICIPIO_ATUAL, rotulo: "Município atual" },
  { fonte: FonteAutomatica.USUARIO_ATUAL, rotulo: "Usuário atual" },
  { fonte: FonteAutomatica.DATA_ATUAL, rotulo: "Data atual" },
  { fonte: FonteAutomatica.ANO_ATUAL, rotulo: "Ano atual" },
  { fonte: FonteAutomatica.COMPETENCIA_ATUAL, rotulo: "Competência atual" },
  { fonte: FonteAutomatica.PROTOCOLO, rotulo: "Protocolo" },
];

export const TIPOS_COM_OPCOES = [
  TipoPergunta.LISTA_SUSPENSA,
  TipoPergunta.RADIO,
  TipoPergunta.CHECKBOX,
];

let contador = 0;
function uid(prefixo: string): string {
  contador += 1;
  return `${prefixo}_${Date.now().toString(36)}_${contador}`;
}

/** Cria uma pergunta em branco do tipo informado, com código único. */
export function criarPergunta(tipo: TipoPergunta): Pergunta {
  const base: Pergunta = {
    codigo: uid("campo"),
    rotulo: "Nova pergunta",
    tipo,
    obrigatorio: false,
  };
  if (TIPOS_COM_OPCOES.includes(tipo)) {
    base.opcoes = [
      { valor: "opcao_1", rotulo: "Opção 1" },
      { valor: "opcao_2", rotulo: "Opção 2" },
    ];
  }
  if (tipo === TipoPergunta.AUTOMATICO) {
    base.fonteAutomatica = FonteAutomatica.CODIGO_IBGE;
  }
  return base;
}

/** Cria uma seção em branco com id local (para DnD). */
export function criarSecao(): SecaoFormulario {
  return { id: uid("sec"), titulo: "Nova seção", perguntas: [] };
}

/** Garante que toda seção tenha um id local estável (para DnD). */
export function normalizarIds(secoes: SecaoFormulario[]): SecaoFormulario[] {
  return secoes.map((s) => ({ ...s, id: s.id ?? uid("sec") }));
}
