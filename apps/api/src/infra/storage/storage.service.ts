import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { Env } from '../../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import type { Arquivo } from '@prisma/client';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: string;
  private readonly localPath: string;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    this.driver = config.get('STORAGE_DRIVER', { infer: true });
    this.localPath = config.get('STORAGE_LOCAL_PATH', { infer: true });
  }

  async salvar(
    buffer: Buffer,
    nomeOriginal: string,
    mimeType?: string,
  ): Promise<Arquivo> {
    const chave = `${randomUUID()}-${nomeOriginal.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

    if (this.driver === 'local') {
      await fs.promises.mkdir(this.localPath, { recursive: true });
      const destino = path.join(this.localPath, chave);
      await fs.promises.writeFile(destino, buffer);
    } else {
      // S3 adapter — a implementar na Fase 2
      throw new InternalServerErrorException('Storage S3 ainda não implementado');
    }

    return this.prisma.arquivo.create({
      data: {
        chave,
        nomeOriginal,
        mimeType,
        tamanhoBytes: buffer.length,
        driver: this.driver,
      },
    });
  }

  async ler(chave: string): Promise<Buffer> {
    const driver = await this.detectarDriver(chave);
    if (driver === 'local') {
      const caminho = path.join(this.localPath, chave);
      return fs.promises.readFile(caminho);
    }
    throw new InternalServerErrorException('Storage S3 ainda não implementado');
  }

  async deletar(chave: string): Promise<void> {
    const driver = await this.detectarDriver(chave);
    if (driver === 'local') {
      const caminho = path.join(this.localPath, chave);
      await fs.promises.rm(caminho, { force: true });
    }
    await this.prisma.arquivo.deleteMany({ where: { chave } });
  }

  private async detectarDriver(chave: string): Promise<string> {
    const arq = await this.prisma.arquivo.findUnique({ where: { chave } });
    return arq?.driver ?? this.driver;
  }
}
