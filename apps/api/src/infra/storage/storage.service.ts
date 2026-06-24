import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  BlobSASPermissions,
  BlobServiceClient,
  type ContainerClient,
} from '@azure/storage-blob';
import type { Env } from '../../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import type { Arquivo } from '@prisma/client';

/** Validade das URLs SAS (upload/download direto pelo navegador). */
const SAS_EXPIRA_MIN = 15;

/**
 * Monta um Content-Disposition seguro: remove CR/LF/aspas do nome (evita
 * header injection / quebra de filename) e usa o formato RFC 5987 (filename*)
 * para nomes com caracteres não-ASCII.
 */
function contentDispositionSeguro(nomeOriginal?: string): string | undefined {
  if (!nomeOriginal) return undefined;
  const limpo = nomeOriginal.replace(/[\r\n"\\]/g, '_').slice(0, 255);
  const asciiFallback = limpo.replace(/[^\x20-\x7E]/g, '_');
  const encoded = encodeURIComponent(limpo);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

/**
 * Armazenamento de arquivos com dois drivers:
 *  - `local`: grava em disco (dev). Upload de anexos passa pelo servidor.
 *  - `azure`: Azure Blob Storage. O navegador envia/baixa o anexo DIRETO ao Blob
 *    via URL SAS (não passa pelo servidor). Anexos limitados a MAX_UPLOAD_MB.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: string;
  private readonly localPath: string;
  private readonly container?: ContainerClient;

  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    this.driver = config.get('STORAGE_DRIVER', { infer: true });
    this.localPath = config.get('STORAGE_LOCAL_PATH', { infer: true });

    if (this.driver === 'azure') {
      const conn = config.get('AZURE_STORAGE_CONNECTION_STRING' as keyof Env, {
        infer: true,
      }) as string;
      const containerName =
        (config.get('AZURE_STORAGE_CONTAINER' as keyof Env, { infer: true }) as string) ||
        'anexos';
      if (!conn) {
        throw new InternalServerErrorException(
          'STORAGE_DRIVER=azure requer AZURE_STORAGE_CONNECTION_STRING.',
        );
      }
      const service = BlobServiceClient.fromConnectionString(conn);
      this.container = service.getContainerClient(containerName);
      this.logger.log(`StorageService: driver=azure container=${containerName}`);
    } else {
      this.logger.log(`StorageService: driver=local path=${this.localPath}`);
    }
  }

  /** True quando o driver Azure está ativo (habilita upload/download direto via SAS). */
  get suportaUploadDireto(): boolean {
    return this.driver === 'azure' && !!this.container;
  }

  /** Gera a chave única do objeto (nome saneado + uuid). */
  private gerarChave(nomeOriginal: string): string {
    return `${randomUUID()}-${nomeOriginal.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
  }

  // ── Upload pelo servidor (modo local/dev) ──────────────────────────────────

  async salvar(buffer: Buffer, nomeOriginal: string, mimeType?: string): Promise<Arquivo> {
    const chave = this.gerarChave(nomeOriginal);

    if (this.driver === 'local') {
      await fs.promises.mkdir(this.localPath, { recursive: true });
      await fs.promises.writeFile(path.join(this.localPath, chave), buffer);
    } else if (this.suportaUploadDireto) {
      await this.container!.getBlockBlobClient(chave).uploadData(buffer, {
        blobHTTPHeaders: mimeType ? { blobContentType: mimeType } : undefined,
      });
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

  // ── Upload direto ao Azure Blob (SAS, single PUT) ──────────────────────────

  /**
   * Gera uma URL SAS de escrita para o navegador enviar o arquivo (PUT único)
   * direto ao Blob. Retorna a chave do objeto e a URL assinada.
   */
  async gerarUploadUrl(nomeOriginal: string, _mimeType?: string): Promise<{ chave: string; url: string }> {
    if (!this.suportaUploadDireto) {
      throw new InternalServerErrorException('Upload direto requer STORAGE_DRIVER=azure.');
    }
    const chave = this.gerarChave(nomeOriginal);
    const blob = this.container!.getBlockBlobClient(chave);
    const url = await blob.generateSasUrl({
      permissions: BlobSASPermissions.parse('cw'),
      expiresOn: new Date(Date.now() + SAS_EXPIRA_MIN * 60_000),
    });
    return { chave, url };
  }

  /** URL SAS de leitura (download direto do Blob com nome de arquivo). */
  async assinarDownload(chave: string, nomeOriginal?: string): Promise<string> {
    if (!this.suportaUploadDireto) {
      throw new InternalServerErrorException('Download direto requer STORAGE_DRIVER=azure.');
    }
    const blob = this.container!.getBlockBlobClient(chave);
    return blob.generateSasUrl({
      permissions: BlobSASPermissions.parse('r'),
      expiresOn: new Date(Date.now() + SAS_EXPIRA_MIN * 60_000),
      contentDisposition: contentDispositionSeguro(nomeOriginal),
    });
  }

  /**
   * Lê os metadados reais de um blob (tamanho/content-type) — usado para validar
   * o anexo de fato enviado, em vez de confiar nos valores reenviados pelo cliente.
   * Retorna null se o blob não existir.
   */
  async statBlob(chave: string): Promise<{ tamanhoBytes: number; contentType?: string } | null> {
    if (!this.suportaUploadDireto) return null;
    try {
      const props = await this.container!.getBlockBlobClient(chave).getProperties();
      return { tamanhoBytes: props.contentLength ?? 0, contentType: props.contentType };
    } catch {
      return null;
    }
  }

  /**
   * Registra a linha Arquivo SEM reupload (o objeto já foi enviado direto ao
   * Blob via SAS). Usado ao concluir o upload de anexo.
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

  // ── Leitura / remoção ──────────────────────────────────────────────────────

  async ler(chave: string): Promise<Buffer> {
    const driver = await this.detectarDriver(chave);
    if (driver === 'local') {
      return fs.promises.readFile(path.join(this.localPath, chave));
    }
    if (driver === 'azure' && this.container) {
      return this.container.getBlockBlobClient(chave).downloadToBuffer();
    }
    throw new InternalServerErrorException(`Driver de storage desconhecido: ${driver}`);
  }

  async deletar(chave: string): Promise<void> {
    const driver = await this.detectarDriver(chave);
    if (driver === 'local') {
      await fs.promises.rm(path.join(this.localPath, chave), { force: true });
    } else if (driver === 'azure' && this.container) {
      await this.container.getBlockBlobClient(chave).deleteIfExists();
    }
    await this.prisma.arquivo.deleteMany({ where: { chave } });
  }

  private async detectarDriver(chave: string): Promise<string> {
    const arq = await this.prisma.arquivo.findUnique({ where: { chave } });
    return arq?.driver ?? this.driver;
  }
}
