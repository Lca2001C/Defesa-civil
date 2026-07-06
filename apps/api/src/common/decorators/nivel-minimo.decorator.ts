import { SetMetadata } from '@nestjs/common';

export const NIVEL_MINIMO_KEY = 'nivelMinimo';

/**
 * Exige que o usuario autenticado tenha `perfilNivel >= nivel`.
 *
 * Barreira por NIVEL, independente das permissoes granulares (@Permissao):
 * garante que apenas perfis de nivel suficiente acessem a rota, MESMO que uma
 * permissao seja concedida indevidamente a um perfil de nivel inferior. Use os
 * valores de PERMISSION_LEVEL (shared/constants).
 *
 * Exemplo: @NivelMinimo(PERMISSION_LEVEL.GESTOR_ESTADUAL)
 */
export const NivelMinimo = (nivel: number) => SetMetadata(NIVEL_MINIMO_KEY, nivel);
