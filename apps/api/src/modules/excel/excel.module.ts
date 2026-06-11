import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ExcelParserService } from './excel-parser.service';
import { ExcelController } from './excel.controller';

@Module({
  imports: [
    MulterModule.register({ storage: memoryStorage() }),
  ],
  providers: [ExcelParserService],
  controllers: [ExcelController],
  exports: [ExcelParserService],
})
export class ExcelModule {}
