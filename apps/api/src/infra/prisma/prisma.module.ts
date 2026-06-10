import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Modulo global do Prisma.
 *
 * Por ser @Global, o PrismaService fica disponivel para injecao em
 * qualquer modulo da aplicacao sem necessidade de reimportar.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
