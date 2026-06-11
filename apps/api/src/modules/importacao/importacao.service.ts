import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { CriarImportacaoDto } from './dto/criar-importacao.dto';
import type { JwtPayload } from '../../common/types/jwt-payload';

export const FILA_IMPORTACAO = 'importacao';

@Injectable()
export class ImportacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue(FILA_IMPORTACAO) private readonly fila: Queue,
  ) {}

  async criar(
    dto: CriarImportacaoDto,
    arquivo: Express.Multer.File,
    usuario: JwtPayload,
  ) {
    // Valida que versão e competência existem
    const versao = await this.prisma.formularioVersao.findUnique({
      where: { id: dto.formularioVersaoId },
    });
    if (!versao) throw new NotFoundException('Versão do formulário não encontrada.');

    const competencia = await this.prisma.competencia.findUnique({
      where: { id: dto.competenciaId },
    });
    if (!competencia) throw new NotFoundException('Competência não encontrada.');
    if (competencia.status !== 'ABERTA') {
      throw new BadRequestException('A competência precisa estar ABERTA para importar dados.');
    }

    // Salva arquivo no storage
    const arq = await this.storage.salvar(
      arquivo.buffer,
      arquivo.originalname,
      arquivo.mimetype,
    );

    // Cria o lote com status PENDENTE
    const lote = await this.prisma.importacaoLote.create({
      data: {
        formularioVersaoId: dto.formularioVersaoId,
        competenciaId: dto.competenciaId,
        municipioId: dto.municipioId ?? null,
        autorId: usuario.sub,
        arquivoId: arq.id,
        status: 'PENDENTE',
      },
    });

    // Enfileira o job de processamento
    await this.fila.add(
      'processar',
      {
        loteId: lote.id,
        mapeamento: dto.mapeamento ?? {},
      },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    return lote;
  }

  async buscarPorId(id: string) {
    const lote = await this.prisma.importacaoLote.findUnique({
      where: { id },
      include: {
        formularioVersao: { select: { versao: true, formulario: { select: { nome: true } } } },
        autor: { select: { nome: true } },
        arquivo: { select: { nomeOriginal: true, tamanhoBytes: true } },
        erros: { orderBy: { linha: 'asc' }, take: 200 },
      },
    });
    if (!lote) throw new NotFoundException('Lote de importação não encontrado.');
    return lote;
  }

  async listar(usuarioId: string) {
    return this.prisma.importacaoLote.findMany({
      where: { autorId: usuarioId },
      orderBy: { criadoEm: 'desc' },
      take: 50,
      include: {
        formularioVersao: { select: { versao: true, formulario: { select: { nome: true } } } },
        arquivo: { select: { nomeOriginal: true } },
      },
    });
  }
}
