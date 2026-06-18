import { Module } from '@nestjs/common';
import { CompetenciasController } from './controllers/competencias.controller';
import { CompetenciasService } from './services/competencias.service';
import { CompetenciasRepository } from './repositories/competencias.repository';

@Module({
  controllers: [CompetenciasController],
  providers: [CompetenciasService, CompetenciasRepository],
  exports: [CompetenciasService],
})
export class CompetenciasModule {}
