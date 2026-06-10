import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marca uma rota como publica (sem autenticacao JWT). */
export const Publico = () => SetMetadata(IS_PUBLIC_KEY, true);
