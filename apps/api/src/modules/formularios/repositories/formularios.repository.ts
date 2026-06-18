import { BadRequestException, Injectable } from '@nestjs/common';
import { Competencia, FormularioStatus, Prisma } from '@prisma/client';
import type {
  PaginaFormulario,
  Pergunta,
  RegraCondicional,
  SchemaFormulario,
  SecaoFormulario,
} from '@dcmg/contracts';
import { PrismaService } from '../../../infra/prisma/prisma.service';

interface MetadadosFormulario {
  nome: string;
  descricao?: string | null;
  categoria?: string | null;
}

/** Acesso a dados de Formulário/Versão/Schema (única camada que toca o Prisma). */
@Injectable()
export class FormulariosRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Formulários ────────────────────────────────────────────────────────────

  criarComSchema(dados: MetadadosFormulario, schema?: SchemaFormulario) {
    return this.prisma.$transaction(async (tx) => {
      const formulario = await tx.formulario.create({
        data: {
          nome: dados.nome,
          descricao: dados.descricao,
          categoria: dados.categoria,
          status: FormularioStatus.RASCUNHO,
        },
      });
      const versao = await tx.formularioVersao.create({
        data: { formularioId: formulario.id, versao: 1, status: FormularioStatus.RASCUNHO },
      });
      if (schema) await this.decomporSchema(tx, versao.id, schema);
      return { ...formulario, versaoInicialId: versao.id };
    });
  }

  async listar(filtros: { status?: FormularioStatus }, skip: number, take: number) {
    const where = filtros.status ? { status: filtros.status } : {};
    const [items, total] = await Promise.all([
      this.prisma.formulario.findMany({
        where,
        skip,
        take,
        orderBy: { criadoEm: 'desc' },
        include: { _count: { select: { versoes: true } } },
      }),
      this.prisma.formulario.count({ where }),
    ]);
    return { items, total };
  }

  buscarPorId(id: string) {
    return this.prisma.formulario.findUnique({
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
  }

  async existe(id: string): Promise<boolean> {
    return !!(await this.prisma.formulario.findUnique({ where: { id }, select: { id: true } }));
  }

  contarSubmissoesDoFormulario(id: string): Promise<number> {
    return this.prisma.submissao.count({ where: { formularioVersao: { formularioId: id } } });
  }

  async removerComVersoes(id: string): Promise<void> {
    await this.prisma.formularioVersao.deleteMany({ where: { formularioId: id } });
    await this.prisma.formulario.delete({ where: { id } });
  }

  atualizarMetadados(id: string, dados: Partial<MetadadosFormulario>) {
    return this.prisma.formulario.update({ where: { id }, data: dados });
  }

  // ── Versões ──────────────────────────────────────────────────────────────

  listarVersoesPublicadas() {
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

  async proximaVersao(formularioId: string): Promise<number> {
    const ultima = await this.prisma.formularioVersao.findFirst({
      where: { formularioId },
      orderBy: { versao: 'desc' },
    });
    return (ultima?.versao ?? 0) + 1;
  }

  async criarVersaoComSchema(formularioId: string, schema: SchemaFormulario): Promise<string> {
    const proximo = await this.proximaVersao(formularioId);
    const novaVersao = await this.prisma.$transaction(async (tx) => {
      const versao = await tx.formularioVersao.create({
        data: { formularioId, versao: proximo, status: FormularioStatus.RASCUNHO },
      });
      await this.decomporSchema(tx, versao.id, schema);
      return versao;
    });
    return novaVersao.id;
  }

  buscarVersaoMeta(versaoId: string) {
    return this.prisma.formularioVersao.findUnique({
      where: { id: versaoId },
      include: {
        formulario: { select: { id: true, nome: true, descricao: true } },
        competencia: { select: { id: true, nome: true, status: true } },
      },
    });
  }

  buscarVersaoComContagem(versaoId: string) {
    return this.prisma.formularioVersao.findUnique({
      where: { id: versaoId },
      include: { _count: { select: { submissoes: true } } },
    });
  }

  buscarVersaoBasica(versaoId: string) {
    return this.prisma.formularioVersao.findUnique({ where: { id: versaoId } });
  }

  async salvarSchema(versaoId: string, schema: SchemaFormulario): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.decomporSchema(tx, versaoId, schema);
    });
  }

  buscarCompetencia(id: string): Promise<Competencia | null> {
    return this.prisma.competencia.findUnique({ where: { id } });
  }

  async publicarVersao(formularioId: string, versaoId: string, competenciaId: string) {
    const [versaoPublicada] = await this.prisma.$transaction([
      this.prisma.formularioVersao.update({
        where: { id: versaoId },
        data: {
          status: FormularioStatus.PUBLICADO,
          competenciaId,
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

  // ── Templates e blocos ─────────────────────────────────────────────────────

  listarTemplates() {
    return this.prisma.formularioTemplate.findMany({
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, descricao: true, categoria: true },
    });
  }

  buscarTemplate(id: string) {
    return this.prisma.formularioTemplate.findUnique({ where: { id } });
  }

  listarBlocos() {
    return this.prisma.blocoReutilizavel.findMany({
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, descricao: true, categoria: true, conteudo: true },
    });
  }

  // ── Compor / Decompor schema ────────────────────────────────────────────────

  /** Monta um SchemaFormulario a partir das linhas normalizadas da versão. */
  comporSchema(versaoId: string): Promise<SchemaFormulario> {
    return this.comporVersao(this.prisma, versaoId);
  }

  private async comporVersao(
    db: PrismaService | Prisma.TransactionClient,
    versaoId: string,
  ): Promise<SchemaFormulario> {
    const versao = await db.formularioVersao.findUniqueOrThrow({
      where: { id: versaoId },
      include: {
        paginas: {
          orderBy: { ordem: 'asc' },
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
        },
      },
    });

    return {
      versao: versao.versao,
      paginas: versao.paginas.map((pg) => ({
        id: pg.id,
        titulo: pg.titulo,
        descricao: pg.descricao ?? undefined,
        ordem: pg.ordem,
        secoes: pg.secoes.map((s) => ({
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
      })),
    };
  }

  /** Apaga e regrava as linhas (paginas/secoes/perguntas/opcoes/regras) de uma versão. */
  private async decomporSchema(
    tx: Prisma.TransactionClient,
    versaoId: string,
    schema: SchemaFormulario,
  ): Promise<void> {
    await tx.pagina.deleteMany({ where: { versaoId } });

    const codigoParaId = new Map<string, string>();
    const regrasPendentes: { alvoCodigo: string; regra: RegraCondicional }[] = [];

    const paginas: PaginaFormulario[] =
      schema.paginas && schema.paginas.length > 0
        ? schema.paginas
        : [{ titulo: 'Página 1', secoes: schema.secoes ?? [] }];

    for (let pgi = 0; pgi < paginas.length; pgi++) {
      const pg = paginas[pgi]!;
      const pagina = await tx.pagina.create({
        data: {
          versaoId,
          ordem: pg.ordem ?? pgi,
          titulo: pg.titulo || `Página ${pgi + 1}`,
          descricao: pg.descricao ?? null,
        },
      });

      const secoes: SecaoFormulario[] = pg.secoes ?? [];
      for (let si = 0; si < secoes.length; si++) {
        const sec = secoes[si]!;
        const secao = await tx.secao.create({
          data: {
            paginaId: pagina.id,
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
