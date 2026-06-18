import { Module } from '@nestjs/common';
import { FormulariosController } from './controllers/formularios.controller';
import { FormulariosService } from './services/formularios.service';
import { FormulariosRepository } from './repositories/formularios.repository';

@Module({
  controllers: [FormulariosController],
  providers: [FormulariosService, FormulariosRepository],
  exports: [FormulariosService],
})
export class FormulariosModule {}
