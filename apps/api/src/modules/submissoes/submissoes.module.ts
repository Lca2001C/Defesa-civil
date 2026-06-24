import { Module } from '@nestjs/common';
import { SubmissoesController } from './controllers/submissoes.controller';
import { SubmissoesService } from './services/submissoes.service';
import { SubmissaoExportService } from './services/submissao-export.service';
import { SubmissoesRepository } from './repositories/submissoes.repository';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { FormulariosModule } from '../formularios/formularios.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { StorageModule } from '../../infra/storage/storage.module';

@Module({
  imports: [NotificacoesModule, FormulariosModule, AuditoriaModule, StorageModule],
  providers: [SubmissoesService, SubmissaoExportService, SubmissoesRepository],
  controllers: [SubmissoesController],
})
export class SubmissoesModule {}
