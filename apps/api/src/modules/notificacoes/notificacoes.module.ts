import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificacoesService, NOTIFICACOES_QUEUE } from './services/notificacoes.service';
import { NotificacoesProcessor } from './processors/notificacoes.processor';

@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICACOES_QUEUE })],
  providers: [NotificacoesService, NotificacoesProcessor],
  exports: [NotificacoesService],
})
export class NotificacoesModule {}
