import { Module } from '@nestjs/common';
import { NotificacoesService } from './services/notificacoes.service';

@Module({
  providers: [NotificacoesService],
  exports: [NotificacoesService],
})
export class NotificacoesModule {}
