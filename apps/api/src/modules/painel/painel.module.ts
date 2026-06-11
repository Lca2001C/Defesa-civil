import { Module } from '@nestjs/common';
import { PainelService } from './painel.service';
import { PainelController } from './painel.controller';

@Module({
  providers: [PainelService],
  controllers: [PainelController],
  exports: [PainelService],
})
export class PainelModule {}
