import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './all-exceptions.filter';

/**
 * Modulo de utilitarios transversais.
 *
 * Registra o filtro global de excecoes via APP_FILTER, garantindo respostas
 * de erro padronizadas em toda a aplicacao. Conforme o dominio crescer,
 * interceptors, guards e pipes compartilhados tambem entram aqui.
 */
@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class CommonModule {}
