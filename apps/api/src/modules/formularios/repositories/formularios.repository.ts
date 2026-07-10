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
    // Include das perguntas com opcoes + regras, reutilizado para subperguntas.
    const includePergunta = {
      opcoes: { orderBy: { ordem: 'asc' as const } },
      regrasComoAlvo: { include: { origem: { select: { codigo: true } } } },
    };

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
                  // Subperguntas de GRUPO nao aparecem direto na secao: elas
                  // sao aninhadas em `perguntas` da pergunta-grupo.
                  where: { grupoPaiId: null },
                  orderBy: { ordem: 'asc' },
                  include: {
                    ...includePergunta,
                    subperguntas: { orderBy: { ordem: 'asc' }, include: includePergunta },
                  },
                },
              },
            },
          },
        },
      },
    });

    type LinhaPergunta = (typeof versao.paginas)[number]['secoes'][number]['perguntas'][number];
    type LinhaSubpergunta = LinhaPergunta['subperguntas'][number];

    const mapearPergunta = (p: LinhaPergunta | LinhaSubpergunta): Pergunta => ({
      id: p.id,
      codigo: p.codigo,
      rotulo: p.rotulo,
      tipo: p.tipo as Pergunta['tipo'],
      obrigatorio: p.obrigatorio,
      ajuda: p.ajuda ?? undefined,
      ordem: p.ordem,
      fonteAutomatica: (p.fonteAutomatica ?? undefined) as Pergunta['fonteAutomatica'],
      multipla: p.multipla || undefined,
      quantidadeOrigemCodigo: p.quantidadeOrigemCodigo ?? undefined,
      minInstancias: p.minInstancias ?? undefined,
      maxInstancias: p.maxInstancias ?? undefined,
      variante: (p.variante ?? undefined) as Pergunta['variante'],
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
      // Subperguntas do GRUPO, aninhadas (ausente nos demais tipos).
      perguntas:
        'subperguntas' in p && p.subperguntas.length
          ? p.subperguntas.map((sub) => mapearPergunta(sub))
          : undefined,
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
          perguntas: s.perguntas.map((p) => mapearPergunta(p)),
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
    // Tipo por codigo APENAS de perguntas top-level (subperguntas de grupo nao
    // podem controlar quantidades — cada instancia teria um valor distinto).
    const tipoTopLevelPorCodigo = new Map<string, string>();
    const regrasPendentes: { alvoCodigo: string; regra: RegraCondicional }[] = [];
    // Grupos com quantidade controlada: validados apos gravar tudo (a pergunta
    // NUMERO controladora pode vir depois do grupo no schema).
    const quantidadesPendentes: { grupoCodigo: string; origemCodigo: string }[] = [];

    /** Grava uma pergunta (top-level ou subpergunta de GRUPO). */
    const criarPergunta = async (
      p: Pergunta,
      secaoId: string,
      ordem: number,
      grupoPaiId: string | null,
      contexto: string,
    ): Promise<void> => {
      if (!p.codigo) {
        throw new BadRequestException(`Pergunta sem 'codigo' em ${contexto}.`);
      }
      // Unicidade GLOBAL (inclui subperguntas): os codigos sao as chaves das
      // respostas e das regras condicionais em todo o schema.
      if (codigoParaId.has(p.codigo)) {
        throw new BadRequestException(`Código de pergunta duplicado: "${p.codigo}".`);
      }

      const ehGrupo = p.tipo === 'GRUPO';
      if (ehGrupo && grupoPaiId) {
        throw new BadRequestException(
          `Grupo "${p.codigo}": grupos repetíveis não podem conter outros grupos.`,
        );
      }
      if (grupoPaiId && (p.tipo === 'UPLOAD' || p.tipo === 'AUTOMATICO')) {
        throw new BadRequestException(
          `Subpergunta "${p.codigo}": os tipos UPLOAD e AUTOMATICO não são suportados dentro de grupos repetíveis.`,
        );
      }
      if (ehGrupo && !p.perguntas?.length) {
        throw new BadRequestException(`Grupo "${p.codigo}" precisa de ao menos uma subpergunta.`);
      }

      const pergunta = await tx.pergunta.create({
        data: {
          secaoId,
          ordem,
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
          multipla: !!p.multipla,
          grupoPaiId,
          quantidadeOrigemCodigo: ehGrupo ? (p.quantidadeOrigemCodigo ?? null) : null,
          minInstancias: ehGrupo ? (p.minInstancias ?? null) : null,
          maxInstancias: ehGrupo ? (p.maxInstancias ?? null) : null,
          variante: p.variante ?? null,
        },
      });
      codigoParaId.set(p.codigo, pergunta.id);
      if (!grupoPaiId) tipoTopLevelPorCodigo.set(p.codigo, p.tipo);

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

      if (ehGrupo) {
        if (p.quantidadeOrigemCodigo) {
          quantidadesPendentes.push({ grupoCodigo: p.codigo, origemCodigo: p.quantidadeOrigemCodigo });
        }
        const subperguntas = p.perguntas ?? [];
        for (let si = 0; si < subperguntas.length; si++) {
          await criarPergunta(
            subperguntas[si]!,
            secaoId,
            subperguntas[si]!.ordem ?? si,
            pergunta.id,
            `grupo "${p.codigo}"`,
          );
        }
      }
    };

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
          await criarPergunta(
            perguntas[pi]!,
            secao.id,
            perguntas[pi]!.ordem ?? pi,
            null,
            `seção "${sec.titulo}"`,
          );
        }
      }
    }

    // A quantidade controladora precisa existir e ser uma pergunta NUMERO
    // top-level (subpergunta nao controla o proprio grupo).
    for (const { grupoCodigo, origemCodigo } of quantidadesPendentes) {
      if (tipoTopLevelPorCodigo.get(origemCodigo) !== 'NUMERO') {
        throw new BadRequestException(
          `Grupo "${grupoCodigo}": a quantidade deve vir de uma pergunta NUMERO fora de grupos (recebido: "${origemCodigo}").`,
        );
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
