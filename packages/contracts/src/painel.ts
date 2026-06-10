/**
 * Contrato do Painel de acompanhamento em tempo real.
 *
 * Define o status de preenchimento por municipio e os eventos WebSocket
 * (Socket.IO) trocados entre o backend e o painel do frontend.
 */

/**
 * Situacao de preenchimento de um municipio em uma competencia.
 *
 * - RESPONDIDO: o municipio ja enviou sua submissao.
 * - EM_PREENCHIMENTO: ha rascunho/edicao em andamento.
 * - NAO_RESPONDEU: nenhuma atividade registrada.
 */
export enum StatusMunicipio {
  RESPONDIDO = 'RESPONDIDO',
  EM_PREENCHIMENTO = 'EM_PREENCHIMENTO',
  NAO_RESPONDEU = 'NAO_RESPONDEU',
}

/**
 * Nomes canonicos dos eventos WebSocket do painel.
 * Use estas constantes ao emitir/ouvir eventos para evitar strings soltas.
 */
export const EVENTOS_PAINEL = {
  /** Emitido pelo servidor quando o status de um municipio muda. */
  PAINEL_ATUALIZADO: 'painel:atualizado',
  /** Emitido pelo cliente para entrar na sala de uma competencia. */
  ENTRAR_COMPETENCIA: 'painel:entrar-competencia',
  /** Emitido pelo cliente para sair da sala de uma competencia. */
  SAIR_COMPETENCIA: 'painel:sair-competencia',
} as const;

/**
 * Tipo dos nomes de evento do painel.
 */
export type EventoPainelNome =
  (typeof EVENTOS_PAINEL)[keyof typeof EVENTOS_PAINEL];

/**
 * Payload do evento emitido quando o status de um municipio e atualizado
 * no painel em tempo real.
 */
export interface EventoPainelAtualizado {
  /** Competencia a qual o status pertence. */
  competenciaId: string;
  /** Municipio cujo status foi atualizado. */
  municipioId: string;
  /** Novo status de preenchimento do municipio. */
  status: StatusMunicipio;
  /** Momento da atualizacao, em ISO 8601. */
  atualizadoEm: string;
}

/**
 * Payload enviado pelo cliente para entrar/sair da sala de uma competencia.
 */
export interface EventoPainelSala {
  /** Competencia cuja sala o cliente deseja acompanhar. */
  competenciaId: string;
}

/**
 * Resumo agregado do andamento de uma competencia, util para a carga
 * inicial do painel antes dos eventos incrementais.
 */
export interface ResumoPainelCompetencia {
  /** Competencia de referencia. */
  competenciaId: string;
  /** Total de municipios esperados. */
  totalMunicipios: number;
  /** Quantidade de municipios que ja responderam. */
  respondidos: number;
  /** Quantidade de municipios em preenchimento. */
  emPreenchimento: number;
  /** Quantidade de municipios que nao responderam. */
  naoResponderam: number;
  /** Momento da apuracao, em ISO 8601. */
  atualizadoEm: string;
}
