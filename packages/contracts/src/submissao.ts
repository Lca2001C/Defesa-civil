/**
 * Contrato de Submissoes e do fluxo de revisao.
 *
 * Uma submissao e a resposta de um municipio a um formulario de uma
 * competencia. Ela percorre um fluxo de estados desde o rascunho ate a
 * validacao (ou rejeicao) por parte do revisor estadual/regional.
 */

/**
 * Estados possiveis de uma submissao ao longo do seu ciclo de vida.
 *
 * Fluxo tipico:
 *   RASCUNHO -> ENVIADA -> EM_ANALISE -> (CORRECAO_SOLICITADA -> ... ) ->
 *   REVISADA -> VALIDADA | REJEITADA
 */
export enum SubmissaoStatus {
  /** Em elaboracao pelo municipio; ainda nao enviada. */
  RASCUNHO = 'RASCUNHO',
  /** Enviada pelo municipio; aguardando triagem. */
  ENVIADA = 'ENVIADA',
  /** Em analise por um revisor. */
  EM_ANALISE = 'EM_ANALISE',
  /** Devolvida ao municipio com pedido de correcao. */
  CORRECAO_SOLICITADA = 'CORRECAO_SOLICITADA',
  /** Revisada pelo revisor (pre-decisao final). */
  REVISADA = 'REVISADA',
  /** Aprovada e validada. */
  VALIDADA = 'VALIDADA',
  /** Recusada definitivamente. */
  REJEITADA = 'REJEITADA',
}

/**
 * Acoes que um revisor pode registrar sobre uma submissao,
 * compondo o historico de revisao.
 */
export enum RevisaoAcao {
  /** Solicitou correcao ao municipio. */
  SOLICITOU_CORRECAO = 'SOLICITOU_CORRECAO',
  /** Marcou a submissao como revisada. */
  REVISOU = 'REVISOU',
  /** Validou (aprovou) a submissao. */
  VALIDOU = 'VALIDOU',
  /** Rejeitou a submissao. */
  REJEITOU = 'REJEITOU',
}
