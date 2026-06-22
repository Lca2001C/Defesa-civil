import { Injectable } from '@nestjs/common';
import {
  Competencia,
  FormularioVersao,
  Prisma,
  Submissao,
  SubmissaoStatus,
  TipoPergunta,
} from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type { JwtPayload } from '../../../common/types/jwt-payload';
import { montarWhereSubmissoes, type FiltrosSubmissao } from '../utils/submissoes-where.util';

interface DadosRespondente {
  protocolo: string;
  municipioId: number;
  formularioVersaoId: string;
  competenciaId: string;
  autorId: string;
  nomeRespondente: string;
  cpfRespondente: string;
  cargoRespondente: string | null;
  emailRespondente: string;
  telefoneRespondente: string | null;
  ipResposta: string | null;
  userAgent: string | null;
  status: SubmissaoStatus;
  enviadoEm: Date | null;
}

/** Acesso a dados de Submissão/Resposta/Anexo (única camada que toca o Prisma). */
@Injectable()
export class SubmissoesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Leituras de apoio ───────────────────────────────────────────────────────

  buscarAutor(usuarioId: string) {
    return this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      select: { nome: true, cpf: true, cargo: true, email: true, telefone: true },
    });
  }

  buscarVersao(versaoId: string): Promise<FormularioVersao | null> {
    return this.prisma.formularioVersao.findUnique({ where: { id: versaoId } });
  }

  buscarCompetencia(id: string): Promise<Competencia | null> {
    return this.prisma.competencia.findUnique({ where: { id } });
  }

  async buscarMunicipioNome(id: number): Promise<string | null> {
    const m = await this.prisma.municipio.findUnique({ where: { id }, select: { nome: true } });
    return m?.nome ?? null;
  }

  perguntasAutomaticas(versaoId: string) {
    return this.prisma.pergunta.findMany({
      where: { secao: { pagina: { versaoId } }, tipo: TipoPergunta.AUTOMATICO },
      select: { codigo: true, fonteAutomatica: true },
    });
  }

  async gerarProtocolo(ufSigla: string, ano: number): Promise<string> {
    const seq = await this.prisma.protocoloSequencia.upsert({
      where: { ufSigla_ano: { ufSigla, ano } },
      update: { ultimoNumero: { increment: 1 } },
      create: { ufSigla, ano, ultimoNumero: 1 },
    });
    return `${ufSigla}-${ano}-${String(seq.ultimoNumero).padStart(8, '0')}`;
  }

  async contextoAutomatico(submissaoId: string) {
    const sub = await this.prisma.submissao.findUniqueOrThrow({
      where: { id: submissaoId },
      include: {
        municipio: { select: { nome: true } },
        autor: { select: { nome: true } },
        competencia: { select: { nome: true } },
      },
    });
    return {
      municipioId: sub.municipioId,
      municipioNome: sub.municipio.nome,
      autorNome: sub.autor.nome,
      competenciaNome: sub.competencia.nome,
    };
  }

  // ── CRUD / leitura ────────────────────────────────────────────────────────

  async criarComRespostas(
    dados: DadosRespondente,
    respostas: Record<string, unknown>,
  ): Promise<Submissao> {
    return this.prisma.$transaction(async (tx) => {
      const nova = await tx.submissao.create({ data: dados });
      await this.sincronizarRespostas(tx, nova.id, dados.formularioVersaoId, respostas);
      return nova;
    });
  }

  async listar(filtros: FiltrosSubmissao, usuario: JwtPayload, skip: number, take: number) {
    const where = montarWhereSubmissoes(filtros, usuario);
    const [items, total] = await Promise.all([
      this.prisma.submissao.findMany({
        where,
        skip,
        take,
        orderBy: { criadoEm: 'desc' },
        include: {
          municipio: { select: { id: true, nome: true, regional: { select: { nome: true } } } },
          competencia: { select: { nome: true } },
          formularioVersao: { select: { versao: true, formulario: { select: { nome: true } } } },
          autor: { select: { nome: true } },
          _count: { select: { historico: true, anexos: true } },
        },
      }),
      this.prisma.submissao.count({ where }),
    ]);
    return { items, total };
  }

  buscarDetalhe(id: string) {
    return this.prisma.submissao.findUnique({
      where: { id },
      include: {
        municipio: { select: { nome: true, uf: { select: { sigla: true } } } },
        formularioVersao: {
          select: { id: true, versao: true, formulario: { select: { nome: true } } },
        },
        competencia: { select: { nome: true, status: true } },
        autor: { select: { nome: true, email: true } },
        respostas: { select: { perguntaCodigo: true, valor: true } },
        historico: {
          orderBy: { criadoEm: 'desc' },
          take: 30,
          include: { autor: { select: { nome: true } } },
        },
        anexos: { include: { arquivo: true }, orderBy: { criadoEm: 'desc' } },
      },
    });
  }

  buscarPorId(id: string): Promise<Submissao | null> {
    return this.prisma.submissao.findUnique({ where: { id } });
  }

  async excluir(id: string): Promise<void> {
    await this.prisma.submissao.delete({ where: { id } });
  }

  // ── Mutações transacionais (respostas + histórico) ──────────────────────────

  async atualizarComHistorico(
    id: string,
    versaoId: string,
    dados: Record<string, unknown>,
    statusAnterior: SubmissaoStatus,
    autorId: string,
  ): Promise<Submissao> {
    const snapshot = await this.lerDados(this.prisma, id);
    return this.prisma.$transaction(async (tx) => {
      await tx.respostaHistorico.create({
        data: {
          submissaoId: id,
          autorId,
          acao: 'EDITOU',
          statusAnterior,
          statusNovo:
            statusAnterior === SubmissaoStatus.RASCUNHO
              ? SubmissaoStatus.EM_PREENCHIMENTO
              : statusAnterior,
          snapshot: snapshot as Prisma.InputJsonValue,
        },
      });
      await this.sincronizarRespostas(tx, id, versaoId, dados);
      return tx.submissao.update({
        where: { id },
        data:
          statusAnterior === SubmissaoStatus.RASCUNHO
            ? { status: SubmissaoStatus.EM_PREENCHIMENTO }
            : {},
      });
    });
  }

  async enviarComHistorico(
    id: string,
    versaoId: string,
    automaticos: Record<string, unknown>,
    statusAnterior: SubmissaoStatus,
    autorId: string,
    protocolo: string,
  ): Promise<Submissao> {
    const snapshot = await this.lerDados(this.prisma, id);
    return this.prisma.$transaction(async (tx) => {
      await this.upsertRespostas(tx, id, versaoId, automaticos);
      await tx.respostaHistorico.create({
        data: {
          submissaoId: id,
          autorId,
          acao: 'ENVIOU',
          statusAnterior,
          statusNovo: SubmissaoStatus.ENVIADO,
          snapshot: snapshot as Prisma.InputJsonValue,
        },
      });
      return tx.submissao.update({
        where: { id },
        data: { status: SubmissaoStatus.ENVIADO, protocolo, enviadoEm: new Date() },
      });
    });
  }

  async transicionarComHistorico(
    id: string,
    statusAnterior: SubmissaoStatus,
    novoStatus: SubmissaoStatus,
    acao: string,
    comentario: string | undefined,
    autorId: string,
  ): Promise<Submissao> {
    const snapshot = await this.lerDados(this.prisma, id);
    return this.prisma.$transaction(async (tx) => {
      await tx.respostaHistorico.create({
        data: {
          submissaoId: id,
          autorId,
          acao,
          comentario: comentario ?? null,
          statusAnterior,
          statusNovo: novoStatus,
          snapshot: snapshot as Prisma.InputJsonValue,
        },
      });
      return tx.submissao.update({
        where: { id },
        data: {
          status: novoStatus,
          ...(novoStatus === SubmissaoStatus.APROVADO ? { aprovadoEm: new Date() } : {}),
        },
      });
    });
  }

  // ── Anexos ───────────────────────────────────────────────────────────────

  listarAnexos(id: string) {
    return this.prisma.anexoSubmissao.findMany({
      where: { submissaoId: id },
      include: { arquivo: true },
      orderBy: { criadoEm: 'desc' },
    });
  }

  criarAnexo(submissaoId: string, arquivoId: string, perguntaCodigo: string | null) {
    return this.prisma.anexoSubmissao.create({
      data: { submissaoId, arquivoId, perguntaCodigo },
      include: { arquivo: true },
    });
  }

  buscarAnexo(anexoId: string) {
    return this.prisma.anexoSubmissao.findUnique({
      where: { id: anexoId },
      include: { arquivo: true },
    });
  }

  async removerAnexo(anexoId: string): Promise<void> {
    await this.prisma.anexoSubmissao.delete({ where: { id: anexoId } });
  }

  // ── Helpers privados ─────────────────────────────────────────────────────

  /** Lê as respostas atuais como { codigo: valor }. */
  private async lerDados(
    db: PrismaService | Prisma.TransactionClient,
    submissaoId: string,
  ): Promise<Record<string, unknown>> {
    const respostas = await db.resposta.findMany({
      where: { submissaoId },
      select: { perguntaCodigo: true, valor: true },
    });
    const dados: Record<string, unknown> = {};
    for (const r of respostas) dados[r.perguntaCodigo] = r.valor;
    return dados;
  }

  /** Substitui todas as respostas da submissão pelos valores informados. */
  private async sincronizarRespostas(
    tx: Prisma.TransactionClient,
    submissaoId: string,
    versaoId: string,
    dados: Record<string, unknown>,
  ): Promise<void> {
    const perguntas = await tx.pergunta.findMany({
      where: { secao: { pagina: { versaoId } } },
      select: { id: true, codigo: true },
    });
    const mapa = new Map(perguntas.map((p) => [p.codigo, p.id]));

    await tx.resposta.deleteMany({ where: { submissaoId } });

    const rows = Object.entries(dados)
      .filter(([codigo]) => mapa.has(codigo))
      .map(([codigo, valor]) => ({
        submissaoId,
        perguntaId: mapa.get(codigo)!,
        perguntaCodigo: codigo,
        valor: (valor ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      }));

    if (rows.length) await tx.resposta.createMany({ data: rows });
  }

  /** Insere/atualiza apenas as respostas informadas (sem apagar as demais). */
  private async upsertRespostas(
    tx: Prisma.TransactionClient,
    submissaoId: string,
    versaoId: string,
    dados: Record<string, unknown>,
  ): Promise<void> {
    const perguntas = await tx.pergunta.findMany({
      where: { secao: { pagina: { versaoId } } },
      select: { id: true, codigo: true },
    });
    const mapa = new Map(perguntas.map((p) => [p.codigo, p.id]));

    for (const [codigo, valor] of Object.entries(dados)) {
      const perguntaId = mapa.get(codigo);
      if (!perguntaId) continue;
      const valorJson = (valor ?? Prisma.JsonNull) as Prisma.InputJsonValue;
      await tx.resposta.upsert({
        where: { submissaoId_perguntaId: { submissaoId, perguntaId } },
        create: { submissaoId, perguntaId, perguntaCodigo: codigo, valor: valorJson },
        update: { valor: valorJson },
      });
    }
  }
}
