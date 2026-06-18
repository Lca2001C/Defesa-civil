import { Module } from '@nestjs/common';
import { PainelController } from './controllers/painel.controller';
import { PainelService } from './services/painel.service';
import { PainelRepository } from './repositories/painel.repository';

@Module({
  controllers: [PainelController],
  providers: [PainelService, PainelRepository],
  exports: [PainelService],
})
export class PainelModule {}
