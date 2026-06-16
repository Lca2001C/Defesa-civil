import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import type { Env } from '../../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import type { Arquivo } from '@prisma/client';

/** Parte concluída de um upload multipart (PartNumber + ETag retornado pelo R2). */
export interface ParteMultipart {
  numero: number;
  etag: string;
}

/** Tamanho de cada parte do multipart (64 MB). 50 GB / 64 MB ≈ 800 partes (< 10.000). */
export const PART_SIZE_BYTES = 64 * 1024 * 1024;

/** Validade das URLs assinadas (2h — cobre uploads longos de partes grandes). */
const PRESIGN_EXPIRA_SEG = 2 * 60 * 60;

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
        tamanhoBytes: BigInt(buffer.length),
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
        tamanhoBytes: BigInt(size),
        driver: this.driver,
      },
    });
  }

  /** True quando o driver S3/R2 está ativo (habilita o fluxo multipart presigned). */
  get suportaPresigned(): boolean {
    return this.driver === 's3' && !!this.s3;
  }

  /** Gera a chave única do objeto (mesmo padrão de salvar). */
  private gerarChave(nomeOriginal: string): string {
    return `${randomUUID()}-${nomeOriginal.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
  }

  // ── Upload multipart direto ao R2 (presigned) ──────────────────────────────

  /** Inicia um upload multipart no R2 e retorna a chave + uploadId. */
  async iniciarMultipart(
    nomeOriginal: string,
    mimeType?: string,
  ): Promise<{ chave: string; uploadId: string }> {
    if (!this.suportaPresigned) {
      throw new InternalServerErrorException('Upload multipart requer STORAGE_DRIVER=s3.');
    }
    const chave = this.gerarChave(nomeOriginal);
    const resp = await this.s3!.send(
      new CreateMultipartUploadCommand({
        Bucket: this.s3Bucket,
        Key: chave,
        ContentType: mimeType,
      }),
    );
    if (!resp.UploadId) {
      throw new InternalServerErrorException('R2 não retornou UploadId.');
    }
    return { chave, uploadId: resp.UploadId };
  }

  /** Gera uma URL assinada para o navegador enviar UMA parte (PUT) direto ao R2. */
  async assinarParte(chave: string, uploadId: string, numeroParte: number): Promise<string> {
    if (!this.suportaPresigned) {
      throw new InternalServerErrorException('Upload multipart requer STORAGE_DRIVER=s3.');
    }
    const comando = new UploadPartCommand({
      Bucket: this.s3Bucket,
      Key: chave,
      UploadId: uploadId,
      PartNumber: numeroParte,
    });
    return getSignedUrl(this.s3!, comando, { expiresIn: PRESIGN_EXPIRA_SEG });
  }

  /** Finaliza o upload multipart juntando as partes (ordenadas por número). */
  async completarMultipart(
    chave: string,
    uploadId: string,
    partes: ParteMultipart[],
  ): Promise<void> {
    if (!this.suportaPresigned) {
      throw new InternalServerErrorException('Upload multipart requer STORAGE_DRIVER=s3.');
    }
    const ordenadas = [...partes].sort((a, b) => a.numero - b.numero);
    await this.s3!.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.s3Bucket,
        Key: chave,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: ordenadas.map((p) => ({ PartNumber: p.numero, ETag: p.etag })),
        },
      }),
    );
  }

  /** Cancela um upload multipart (libera as partes órfãs no R2). */
  async abortarMultipart(chave: string, uploadId: string): Promise<void> {
    if (!this.suportaPresigned) return;
    await this.s3!.send(
      new AbortMultipartUploadCommand({
        Bucket: this.s3Bucket,
        Key: chave,
        UploadId: uploadId,
      }),
    );
  }

  /** URL assinada de download (GET) — para baixar arquivos grandes direto do R2. */
  async assinarDownload(chave: string, nomeOriginal?: string): Promise<string> {
    if (!this.suportaPresigned) {
      throw new InternalServerErrorException('Download assinado requer STORAGE_DRIVER=s3.');
    }
    const comando = new GetObjectCommand({
      Bucket: this.s3Bucket,
      Key: chave,
      ...(nomeOriginal
        ? { ResponseContentDisposition: `attachment; filename="${nomeOriginal}"` }
        : {}),
    });
    return getSignedUrl(this.s3!, comando, { expiresIn: PRESIGN_EXPIRA_SEG });
  }

  /**
   * Registra a linha Arquivo SEM reupload (o objeto já foi enviado direto ao R2).
   * Usado ao concluir o multipart.
   */
  async registrarArquivo(dados: {
    chave: string;
    nomeOriginal: string;
    mimeType?: string;
    tamanhoBytes: number;
  }): Promise<Arquivo> {
    return this.prisma.arquivo.create({
      data: {
        chave: dados.chave,
        nomeOriginal: dados.nomeOriginal,
        mimeType: dados.mimeType,
        tamanhoBytes: BigInt(Math.max(0, Math.round(dados.tamanhoBytes))),
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
