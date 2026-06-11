import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificacoesService, NOTIFICACOES_QUEUE } from './notificacoes.service';
import { NotificacoesProcessor } from './notificacoes.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: NOTIFICACOES_QUEUE }),
  ],
  providers: [NotificacoesService, NotificacoesProcessor],
  exports: [NotificacoesService],
})
export class NotificacoesModule {}
