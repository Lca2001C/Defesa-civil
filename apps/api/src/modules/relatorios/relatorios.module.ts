import { Module } from '@nestjs/common';
import { RelatoriosController } from './controllers/relatorios.controller';
import { RelatoriosService } from './services/relatorios.service';
import { RelatoriosRepository } from './repositories/relatorios.repository';

@Module({
  controllers: [RelatoriosController],
  providers: [RelatoriosService, RelatoriosRepository],
})
export class RelatoriosModule {}
