import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RelatoriosController } from './relatorios.controller';
import { RelatoriosService, RELATORIOS_QUEUE } from './relatorios.service';
import { RelatoriosProcessor } from './relatorios.processor';

@Module({
  imports: [BullModule.registerQueue({ name: RELATORIOS_QUEUE })],
  controllers: [RelatoriosController],
  providers: [RelatoriosService, RelatoriosProcessor],
})
export class RelatoriosModule {}
