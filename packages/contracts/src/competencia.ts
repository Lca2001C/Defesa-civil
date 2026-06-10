/**
 * Contrato de Competencias.
 *
 * Uma competencia representa um ciclo de coleta (ex.: um periodo mensal ou
 * anual) durante o qual os municipios devem responder a um formulario.
 */

/**
 * Situacao do ciclo de uma competencia.
 *
 * - PLANEJADA: criada, porem ainda nao disponivel para preenchimento.
 * - ABERTA: em vigencia; municipios podem enviar submissoes.
 * - ENCERRADA: ciclo finalizado; nao aceita novas submissoes.
 */
export enum CompetenciaStatus {
  PLANEJADA = 'PLANEJADA',
  ABERTA = 'ABERTA',
  ENCERRADA = 'ENCERRADA',
}
