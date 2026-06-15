import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import type { Env } from '../../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import type { Arquivo } from '@prisma/client';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: string;
  private readonly localPath: string;
  private readonly s3?: S3Client;
  private readonly s3Bucket?: string;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    this.driver = config.get('STORAGE_DRIVER', { infer: true });
    this.localPath = config.get('STORAGE_LOCAL_PATH', { infer: true });

    if (this.driver === 's3') {
      const endpoint = config.get('S3_ENDPOINT', { infer: true });
      const region = config.get('S3_REGION', { infer: true });
      const accessKeyId = config.get('S3_ACCESS_KEY', { infer: true });
      const secretAccessKey = config.get('S3_SECRET_KEY', { infer: true });
      const forcePathStyle = config.get('S3_FORCE_PATH_STYLE', { infer: true });

      this.s3Bucket = config.get('S3_BUCKET', { infer: true });
      this.s3 = new S3Client({
        ...(endpoint ? { endpoint } : {}),
        region: region || 'us-east-1',
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle,
      });
      this.logger.log(`StorageService: driver=s3 bucket=${this.s3Bucket}`);
    } else {
      this.logger.log(`StorageService: driver=local path=${this.localPath}`);
    }
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
    } else if (this.driver === 's3') {
      await this.s3!.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: chave,
          Body: buffer,
          ContentType: mimeType,
        }),
      );
    } else {
      throw new InternalServerErrorException(`Driver de storage desconhecido: ${this.driver}`);
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

  /**
   * Persiste um arquivo já existente em disco (caminho temporário), sem carregá-lo
   * inteiro em memória. Ideal para artefatos grandes gerados em streaming (ex.: export Excel).
   */
  async salvarDeCaminho(
    caminhoTmp: string,
    nomeOriginal: string,
    mimeType?: string,
  ): Promise<Arquivo> {
    const chave = `${randomUUID()}-${nomeOriginal.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const { size } = await fs.promises.stat(caminhoTmp);

    if (this.driver === 'local') {
      await fs.promises.mkdir(this.localPath, { recursive: true });
      const destino = path.join(this.localPath, chave);
      await fs.promises.copyFile(caminhoTmp, destino);
    } else if (this.driver === 's3') {
      await this.s3!.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: chave,
          Body: fs.createReadStream(caminhoTmp),
          ContentType: mimeType,
          ContentLength: size,
        }),
      );
    } else {
      throw new InternalServerErrorException(`Driver de storage desconhecido: ${this.driver}`);
    }

    return this.prisma.arquivo.create({
      data: {
        chave,
        nomeOriginal,
        mimeType,
        tamanhoBytes: size,
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

    if (driver === 's3') {
      const resp = await this.s3!.send(
        new GetObjectCommand({ Bucket: this.s3Bucket, Key: chave }),
      );
      const stream = resp.Body as Readable;
      return new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    }

    throw new InternalServerErrorException(`Driver de storage desconhecido: ${driver}`);
  }

  async deletar(chave: string): Promise<void> {
    const driver = await this.detectarDriver(chave);

    if (driver === 'local') {
      const caminho = path.join(this.localPath, chave);
      await fs.promises.rm(caminho, { force: true });
    } else if (driver === 's3') {
      await this.s3!.send(
        new DeleteObjectCommand({ Bucket: this.s3Bucket, Key: chave }),
      );
    }

    await this.prisma.arquivo.deleteMany({ where: { chave } });
  }

  private async detectarDriver(chave: string): Promise<string> {
    const arq = await this.prisma.arquivo.findUnique({ where: { chave } });
    return arq?.driver ?? this.driver;
  }
}
