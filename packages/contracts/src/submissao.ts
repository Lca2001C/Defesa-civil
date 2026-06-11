/**
 * Contrato de Submissoes e do fluxo de revisao.
 *
 * Uma submissao e a resposta de um municipio a um formulario de uma
 * competencia. Workflow de 6 estados, do rascunho ate a aprovacao.
 */

/**
 * Estados possiveis de uma submissao ao longo do seu ciclo de vida.
 *
 * Fluxo tipico:
 *   RASCUNHO -> EM_PREENCHIMENTO -> ENVIADO ->
 *   (CORRECAO_SOLICITADA -> REVISADO -> ...) -> APROVADO
 */
export enum SubmissaoStatus {
  /** Criada; ainda sem preenchimento. */
  RASCUNHO = 'RASCUNHO',
  /** Em preenchimento pelo municipio; ainda nao enviada. */
  EM_PREENCHIMENTO = 'EM_PREENCHIMENTO',
  /** Enviada pelo municipio; aguardando analise. */
  ENVIADO = 'ENVIADO',
  /** Devolvida ao municipio com pedido de correcao. */
  CORRECAO_SOLICITADA = 'CORRECAO_SOLICITADA',
  /** Reenviada pelo municipio apos correcao. */
  REVISADO = 'REVISADO',
  /** Aprovada pelo analista. */
  APROVADO = 'APROVADO',
}
