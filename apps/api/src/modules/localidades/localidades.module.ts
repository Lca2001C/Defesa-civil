import { Module } from '@nestjs/common';
import { LocalidadesController } from './controllers/localidades.controller';
import { LocalidadesService } from './services/localidades.service';
import { LocalidadesRepository } from './repositories/localidades.repository';

@Module({
  controllers: [LocalidadesController],
  providers: [LocalidadesService, LocalidadesRepository],
  exports: [LocalidadesService],
})
export class LocalidadesModule {}
