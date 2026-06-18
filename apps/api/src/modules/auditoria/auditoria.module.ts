import { Module } from '@nestjs/common';
import { AuditoriaController } from './controllers/auditoria.controller';
import { AuditoriaService } from './services/auditoria.service';
import { AuditoriaRepository } from './repositories/auditoria.repository';

@Module({
  controllers: [AuditoriaController],
  providers: [AuditoriaService, AuditoriaRepository],
})
export class AuditoriaModule {}
