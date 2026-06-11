import { Module } from '@nestjs/common';
import { SubmissoesService } from './submissoes.service';
import { SubmissoesController } from './submissoes.controller';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [RealtimeModule, NotificacoesModule],
  providers: [SubmissoesService],
  controllers: [SubmissoesController],
})
export class SubmissoesModule {}
