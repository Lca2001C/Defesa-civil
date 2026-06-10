import { SetMetadata } from '@nestjs/common';

export const PERMISSAO_KEY = 'permissoes';

/**
 * Exige que o usuario autenticado possua TODAS as permissoes listadas.
 *
 * Exemplo: @Permissao('formularios.publicar', 'competencias.gerenciar')
 */
export const Permissao = (...permissoes: string[]) =>
  SetMetadata(PERMISSAO_KEY, permissoes);
