import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompetenciaStatus, FormularioStatus, Prisma } from '@prisma/client';
import type {
  Pergunta,
  RegraCondicional,
  SchemaFormulario,
  SecaoFormulario,
} from '@dcmg/contracts';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { PaginacaoDto } from '../../common/dto/paginacao.dto';
import type { CriarFormularioDto } from './dto/criar-formulario.dto';
import type { AtualizarFormularioDto } from './dto/atualizar-formulario.dto';
import type { CriarVersaoDto } from './dto/criar-versao.dto';
import type { PublicarVersaoDto } from './dto/publicar-versao.dto';

@Injectable()
export class FormulariosService {
  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────── Formulários ─────────────────────────────────

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

      const versao = await tx.formularioVersao.create({
        data: { formularioId: formulario.id, versao: 1, status: FormularioStatus.RASCUNHO },
      });

      if (dto.schema) {
        await this.decomporSchema(tx, versao.id, dto.schema as unknown as SchemaFormulario);
      }

      return { ...formulario, versaoInicialId: versao.id };
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
        include: { _count: { select: { versoes: true } } },
      }),
      this.prisma.formulario.count({ where }),
    ]);

    return { items, total, pagina, porPagina, totalPaginas: Math.ceil(total / porPagina) };
  }

  /** Metadados do formulário + resumo das versões (sem o schema composto). */
  async buscarPorId(id: string) {
    const form = await this.prisma.formulario.findUnique({
      where: { id },
      include: {
        versoes: {
          orderBy: { versao: 'desc' },
          select: {
            id: true,
            versao: true,
            status: true,
            publicadoEm: true,
            competencia: { select: { id: true, nome: true, status: true } },
            _count: { select: { submissoes: true } },
          },
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

  // ───────────────────────────── Versões ────────────────────────────────────

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

  /** Cria uma nova versão (rascunho) a partir de um schema. */
  async criarVersao(formularioId: string, dto: CriarVersaoDto) {
    const form = await this.prisma.formulario.findUnique({ where: { id: formularioId } });
    if (!form) throw new NotFoundException(`Formulário '${formularioId}' não encontrado.`);

    const ultima = await this.prisma.formularioVersao.findFirst({
      where: { formularioId },
      orderBy: { versao: 'desc' },
    });
    const proximo = (ultima?.versao ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      const versao = await tx.formularioVersao.create({
        data: { formularioId, versao: proximo, status: FormularioStatus.RASCUNHO },
      });
      await this.decomporSchema(tx, versao.id, dto.schema as unknown as SchemaFormulario);
      return this.comporVersao(tx, versao.id);
    });
  }

  /** Retorna uma versão com o schema COMPOSTO (secoes→perguntas→opcoes→regras). */
  async buscarVersao(formularioId: string, versaoId: string) {
    const versao = await this.prisma.formularioVersao.findUnique({
      where: { id: versaoId },
      include: {
        formulario: { select: { id: true, nome: true, descricao: true } },
        competencia: { select: { id: true, nome: true, status: true } },
      },
    });
    if (!versao || versao.formularioId !== formularioId) {
      throw new NotFoundException(`Versão '${versaoId}' não encontrada neste formulário.`);
    }
    const schema = await this.comporSchema(versaoId);
    schema.titulo = versao.formulario.nome;
    schema.descricao = versao.formulario.descricao ?? undefined;
    return {
      id: versao.id,
      versao: versao.versao,
      status: versao.status,
      publicadoEm: versao.publicadoEm,
      competenciaId: versao.competenciaId,
      competencia: versao.competencia,
      formulario: versao.formulario,
      schema,
    };
  }

  /**
   * Salva edições do construtor numa versão.
   * Versionamento automático: se a versão está PUBLICADA e já tem submissões,
   * cria uma nova versão (rascunho) com o schema editado; senão edita no lugar.
   */
  async salvarVersao(formularioId: string, versaoId: string, dto: CriarVersaoDto) {
    const versao = await this.prisma.formularioVersao.findUnique({
      where: { id: versaoId },
      include: { _count: { select: { submissoes: true } } },
    });
    if (!versao || versao.formularioId !== formularioId) {
      throw new NotFoundException(`Versão '${versaoId}' não encontrada neste formulário.`);
    }

    const precisaNovaVersao =
      versao.status === FormularioStatus.PUBLICADO && versao._count.submissoes > 0;

    if (precisaNovaVersao) {
      return this.criarVersao(formularioId, dto);
    }

    return this.prisma.$transaction(async (tx) => {
      await this.decomporSchema(tx, versaoId, dto.schema as unknown as SchemaFormulario);
      return this.comporVersao(tx, versaoId);
    });
  }

  async publicarVersao(formularioId: string, versaoId: string, dto: PublicarVersaoDto) {
    const versao = await this.prisma.formularioVersao.findUnique({ where: { id: versaoId } });
    if (!versao || versao.formularioId !== formularioId) {
      throw new NotFoundException(`Versão '${versaoId}' não encontrada neste formulário.`);
    }
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

  // ──────────────────── Templates e blocos reutilizáveis ─────────────────────

  async listarTemplates() {
    return this.prisma.formularioTemplate.findMany({
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, descricao: true, categoria: true },
    });
  }

  /** Cria um formulário (v1 rascunho) a partir de um template. */
  async criarDeTemplate(templateId: string) {
    const template = await this.prisma.formularioTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new NotFoundException(`Template '${templateId}' não encontrado.`);

    const schema = template.schema as unknown as SchemaFormulario;

    return this.prisma.$transaction(async (tx) => {
      const formulario = await tx.formulario.create({
        data: {
          nome: schema.titulo ?? template.nome,
          descricao: schema.descricao ?? template.descricao,
          categoria: template.categoria,
          status: FormularioStatus.RASCUNHO,
        },
      });
      const versao = await tx.formularioVersao.create({
        data: { formularioId: formulario.id, versao: 1, status: FormularioStatus.RASCUNHO },
      });
      await this.decomporSchema(tx, versao.id, schema);
      return { ...formulario, versaoInicialId: versao.id };
    });
  }

  async listarBlocos() {
    return this.prisma.blocoReutilizavel.findMany({
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, descricao: true, categoria: true, conteudo: true },
    });
  }

  // ─────────────────────── Compor / Decompor schema ──────────────────────────

  /** Monta um SchemaFormulario a partir das linhas normalizadas da versão. */
  async comporSchema(versaoId: string): Promise<SchemaFormulario> {
    return this.comporVersao(this.prisma, versaoId);
  }

  private async comporVersao(
    db: PrismaService | Prisma.TransactionClient,
    versaoId: string,
  ): Promise<SchemaFormulario> {
    const versao = await db.formularioVersao.findUniqueOrThrow({
      where: { id: versaoId },
      include: {
        secoes: {
          orderBy: { ordem: 'asc' },
          include: {
            perguntas: {
              orderBy: { ordem: 'asc' },
              include: {
                opcoes: { orderBy: { ordem: 'asc' } },
                regrasComoAlvo: { include: { origem: { select: { codigo: true } } } },
              },
            },
          },
        },
      },
    });

    return {
      versao: versao.versao,
      secoes: versao.secoes.map((s) => ({
        id: s.id,
        titulo: s.titulo,
        descricao: s.descricao ?? undefined,
        ordem: s.ordem,
        perguntas: s.perguntas.map((p) => ({
          id: p.id,
          codigo: p.codigo,
          rotulo: p.rotulo,
          tipo: p.tipo as Pergunta['tipo'],
          obrigatorio: p.obrigatorio,
          ajuda: p.ajuda ?? undefined,
          ordem: p.ordem,
          fonteAutomatica: (p.fonteAutomatica ?? undefined) as Pergunta['fonteAutomatica'],
          validacoes: {
            min: p.min ?? undefined,
            max: p.max ?? undefined,
            padrao: p.padrao ?? undefined,
            tamanhoMaximoMb: p.tamanhoMaximoMb ?? undefined,
            tiposArquivo: p.tiposArquivo.length ? p.tiposArquivo : undefined,
          },
          opcoes: p.opcoes.map((o) => ({ valor: o.valor, rotulo: o.rotulo, ordem: o.ordem })),
          regras: p.regrasComoAlvo.map((r) => ({
            origemCodigo: r.origem.codigo,
            operador: r.operador as RegraCondicional['operador'],
            valor: r.valor,
            acao: r.acao as RegraCondicional['acao'],
          })),
        })),
      })),
    };
  }

  /** Apaga e regrava as linhas (secoes/perguntas/opcoes/regras) de uma versão. */
  async decomporSchema(
    tx: Prisma.TransactionClient,
    versaoId: string,
    schema: SchemaFormulario,
  ): Promise<void> {
    await tx.secao.deleteMany({ where: { versaoId } });

    const codigoParaId = new Map<string, string>();
    const regrasPendentes: { alvoCodigo: string; regra: RegraCondicional }[] = [];

    const secoes: SecaoFormulario[] = schema.secoes ?? [];
    for (let si = 0; si < secoes.length; si++) {
      const sec = secoes[si]!;
      const secao = await tx.secao.create({
        data: {
          versaoId,
          ordem: sec.ordem ?? si,
          titulo: sec.titulo || `Seção ${si + 1}`,
          descricao: sec.descricao ?? null,
        },
      });

      const perguntas: Pergunta[] = sec.perguntas ?? [];
      for (let pi = 0; pi < perguntas.length; pi++) {
        const p = perguntas[pi]!;
        if (!p.codigo) {
          throw new BadRequestException(`Pergunta sem 'codigo' na seção "${sec.titulo}".`);
        }
        if (codigoParaId.has(p.codigo)) {
          throw new BadRequestException(`Código de pergunta duplicado: "${p.codigo}".`);
        }
        const pergunta = await tx.pergunta.create({
          data: {
            secaoId: secao.id,
            ordem: p.ordem ?? pi,
            codigo: p.codigo,
            rotulo: p.rotulo,
            tipo: p.tipo,
            obrigatorio: !!p.obrigatorio,
            ajuda: p.ajuda ?? null,
            min: p.validacoes?.min ?? null,
            max: p.validacoes?.max ?? null,
            padrao: p.validacoes?.padrao ?? null,
            tamanhoMaximoMb: p.validacoes?.tamanhoMaximoMb ?? null,
            tiposArquivo: p.validacoes?.tiposArquivo ?? [],
            fonteAutomatica: p.fonteAutomatica ?? null,
          },
        });
        codigoParaId.set(p.codigo, pergunta.id);

        if (p.opcoes?.length) {
          await tx.opcaoPergunta.createMany({
            data: p.opcoes.map((o, i) => ({
              perguntaId: pergunta.id,
              ordem: o.ordem ?? i,
              valor: o.valor,
              rotulo: o.rotulo,
            })),
          });
        }

        for (const regra of p.regras ?? []) {
          regrasPendentes.push({ alvoCodigo: p.codigo, regra });
        }
      }
    }

    for (const { alvoCodigo, regra } of regrasPendentes) {
      const alvoId = codigoParaId.get(alvoCodigo);
      const origemId = codigoParaId.get(regra.origemCodigo);
      if (alvoId && origemId) {
        await tx.regraCondicional.create({
          data: {
            perguntaAlvoId: alvoId,
            perguntaOrigemId: origemId,
            operador: regra.operador ?? 'IGUAL',
            valor: regra.valor,
            acao: regra.acao ?? 'MOSTRAR',
          },
        });
      }
    }
  }
}
