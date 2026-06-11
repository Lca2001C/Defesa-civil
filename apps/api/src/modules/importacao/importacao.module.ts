import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ImportacaoService, FILA_IMPORTACAO } from './importacao.service';
import { ImportacaoController } from './importacao.controller';
import { ImportacaoProcessor } from './importacao.processor';
import { ExcelModule } from '../excel/excel.module';

@Module({
  imports: [
    MulterModule.register({ storage: memoryStorage() }),
    BullModule.registerQueue({ name: FILA_IMPORTACAO }),
    ExcelModule,
  ],
  providers: [ImportacaoService, ImportacaoProcessor],
  controllers: [ImportacaoController],
})
export class ImportacaoModule {}
