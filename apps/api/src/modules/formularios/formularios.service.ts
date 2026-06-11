import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompetenciaStatus, FormularioStatus } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { PaginacaoDto } from '../../common/dto/paginacao.dto';
import type { CriarFormularioDto } from './dto/criar-formulario.dto';
import type { AtualizarFormularioDto } from './dto/atualizar-formulario.dto';
import type { CriarVersaoDto } from './dto/criar-versao.dto';
import type { PublicarVersaoDto } from './dto/publicar-versao.dto';

@Injectable()
export class FormulariosService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(dto: CriarFormularioDto) {
    return this.prisma.$transaction(async (tx) => {
      const formulario = await tx.formulario.create({
        data: {
          nome: dto.nome,
          descricao: dto.descricao,
          categoria: dto.categoria,
          status: FormularioStatus.RASCUNHO,
        },
      });

      if (dto.schema) {
        await tx.formularioVersao.create({
          data: {
            formularioId: formulario.id,
            versao: 1,
            schema: dto.schema as object,
            status: FormularioStatus.RASCUNHO,
          },
        });
      }

      return formulario;
    });
  }

  async buscarTodos(paginacao: PaginacaoDto, filtros: { status?: FormularioStatus }) {
    const pagina = paginacao.pagina ?? 1;
    const porPagina = paginacao.porPagina ?? 20;
    const skip = (pagina - 1) * porPagina;

    const where = filtros.status ? { status: filtros.status } : {};

    const [items, total] = await Promise.all([
      this.prisma.formulario.findMany({
        where,
        skip,
        take: porPagina,
        orderBy: { criadoEm: 'desc' },
        include: {
          _count: { select: { versoes: true } },
        },
      }),
      this.prisma.formulario.count({ where }),
    ]);

    return { items, total, pagina, porPagina, totalPaginas: Math.ceil(total / porPagina) };
  }

  async buscarPorId(id: string) {
    const form = await this.prisma.formulario.findUnique({
      where: { id },
      include: {
        versoes: {
          orderBy: { versao: 'desc' },
          include: { competencia: true },
        },
      },
    });
    if (!form) throw new NotFoundException(`Formulário '${id}' não encontrado.`);
    return form;
  }

  async atualizar(id: string, dto: AtualizarFormularioDto) {
    await this.buscarPorId(id);
    return this.prisma.formulario.update({
      where: { id },
      data: {
        ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
        ...(dto.descricao !== undefined ? { descricao: dto.descricao } : {}),
        ...(dto.categoria !== undefined ? { categoria: dto.categoria } : {}),
      },
    });
  }

  async listarVersoesPublicadas() {
    return this.prisma.formularioVersao.findMany({
      where: { status: FormularioStatus.PUBLICADO },
      orderBy: { publicadoEm: 'desc' },
      select: {
        id: true,
        versao: true,
        publicadoEm: true,
        formulario: { select: { id: true, nome: true } },
        competencia: { select: { id: true, nome: true } },
      },
    });
  }

  async criarVersao(formularioId: string, dto: CriarVersaoDto) {
    const form = await this.prisma.formulario.findUnique({ where: { id: formularioId } });
    if (!form) throw new NotFoundException(`Formulário '${formularioId}' não encontrado.`);

    const ultimaVersao = await this.prisma.formularioVersao.findFirst({
      where: { formularioId },
      orderBy: { versao: 'desc' },
    });
    const proximoNumero = (ultimaVersao?.versao ?? 0) + 1;

    return this.prisma.formularioVersao.create({
      data: {
        formularioId,
        versao: proximoNumero,
        // Cast necessario: Prisma exige InputJsonValue para campos Json.
        schema: dto.schema as object,
        status: FormularioStatus.RASCUNHO,
      },
    });
  }

  async buscarVersao(formularioId: string, versaoId: string) {
    const versao = await this.prisma.formularioVersao.findUnique({
      where: { id: versaoId },
      include: { competencia: true },
    });
    if (!versao || versao.formularioId !== formularioId) {
      throw new NotFoundException(`Versão '${versaoId}' não encontrada neste formulário.`);
    }
    return versao;
  }

  async publicarVersao(
    formularioId: string,
    versaoId: string,
    dto: PublicarVersaoDto,
  ) {
    const versao = await this.buscarVersao(formularioId, versaoId);

    if (versao.status !== FormularioStatus.RASCUNHO) {
      throw new BadRequestException(
        `Apenas versões em RASCUNHO podem ser publicadas. Status atual: ${versao.status}.`,
      );
    }

    const competencia = await this.prisma.competencia.findUnique({
      where: { id: dto.competenciaId },
    });
    if (!competencia) {
      throw new NotFoundException(`Competência '${dto.competenciaId}' não encontrada.`);
    }
    if (competencia.status !== CompetenciaStatus.ABERTA) {
      throw new BadRequestException(
        `A competência deve estar ABERTA para publicar. Status atual: ${competencia.status}.`,
      );
    }

    // Publica a versão e, se necessário, atualiza o status do formulário pai.
    const [versaoPublicada] = await this.prisma.$transaction([
      this.prisma.formularioVersao.update({
        where: { id: versaoId },
        data: {
          status: FormularioStatus.PUBLICADO,
          competenciaId: dto.competenciaId,
          publicadoEm: new Date(),
        },
        include: { competencia: true },
      }),
      this.prisma.formulario.update({
        where: { id: formularioId },
        data: { status: FormularioStatus.PUBLICADO },
      }),
    ]);

    return versaoPublicada;
  }
}
