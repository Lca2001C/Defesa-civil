import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RelatoriosController } from './controllers/relatorios.controller';
import { RelatoriosService, RELATORIOS_QUEUE } from './services/relatorios.service';
import { RelatoriosRepository } from './repositories/relatorios.repository';
import { RelatoriosProcessor } from './relatorios.processor';

@Module({
  imports: [BullModule.registerQueue({ name: RELATORIOS_QUEUE })],
  controllers: [RelatoriosController],
  providers: [RelatoriosService, RelatoriosRepository, RelatoriosProcessor],
})
export class RelatoriosModule {}
