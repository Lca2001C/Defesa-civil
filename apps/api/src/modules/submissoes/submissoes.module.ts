import { Module } from '@nestjs/common';
import { SubmissoesService } from './submissoes.service';
import { SubmissoesController } from './submissoes.controller';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { FormulariosModule } from '../formularios/formularios.module';
import { StorageModule } from '../../infra/storage/storage.module';

@Module({
  imports: [RealtimeModule, NotificacoesModule, FormulariosModule, StorageModule],
  providers: [SubmissoesService],
  controllers: [SubmissoesController],
})
export class SubmissoesModule {}
