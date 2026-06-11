import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompetenciaStatus,
  FormularioStatus,
  Prisma,
  SubmissaoStatus,
  RevisaoAcao,
} from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import type { PaginacaoDto } from '../../common/dto/paginacao.dto';
import type { JwtPayload } from '../../common/types/jwt-payload';
import type { CriarSubmissaoDto } from './dto/criar-submissao.dto';
import type { AtualizarSubmissaoDto } from './dto/atualizar-submissao.dto';
import type { RevisaoDto } from './dto/revisao.dto';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

// Transições válidas de status
const TRANSICOES: Partial<Record<SubmissaoStatus, SubmissaoStatus>> = {
  [SubmissaoStatus.RASCUNHO]: SubmissaoStatus.ENVIADA,
  [SubmissaoStatus.ENVIADA]: SubmissaoStatus.EM_ANALISE,
  [SubmissaoStatus.EM_ANALISE]: SubmissaoStatus.CORRECAO_SOLICITADA,
  [SubmissaoStatus.CORRECAO_SOLICITADA]: SubmissaoStatus.REVISADA,
};

@Injectable()
export class SubmissoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly notificacoes: NotificacoesService,
  ) {}

  // ------------------------------------------------------------------ criar --

  async criar(
    dto: CriarSubmissaoDto,
    usuario: JwtPayload,
    ip?: string,
    userAgent?: string,
  ) {
    // Busca dados do usuário para o snapshot
    const autor = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuario.sub },
      select: { nome: true, cpf: true, cargo: true, email: true, telefone: true },
    });

    // Valida versão e competência
    const versao = await this.prisma.formularioVersao.findUnique({
      where: { id: dto.formularioVersaoId },
    });
    if (!versao) throw new NotFoundException('Versão do formulário não encontrada.');
    if (versao.status !== FormularioStatus.PUBLICADO) {
      throw new BadRequestException('A versão do formulário precisa estar PUBLICADA.');
    }

    const competencia = await this.prisma.competencia.findUnique({
      where: { id: dto.competenciaId },
    });
    if (!competencia) throw new NotFoundException('Competência não encontrada.');
    if (competencia.status !== CompetenciaStatus.ABERTA) {
      throw new BadRequestException('A competência precisa estar ABERTA para enviar respostas.');
    }

    const enviar = dto.enviarImediatamente === true;

    // Gera protocolo apenas ao enviar
    const protocolo = enviar
      ? await this.gerarProtocolo('MG', new Date().getFullYear())
      : `RASCUNHO-${Date.now()}`;

    const submissao = await this.prisma.submissao.create({
      data: {
        protocolo,
        municipioId: dto.municipioId,
        formularioVersaoId: dto.formularioVersaoId,
        competenciaId: dto.competenciaId,
        autorId: usuario.sub,
        nomeRespondente: dto.nomeRespondente ?? autor.nome,
        cpfRespondente: dto.cpfRespondente ?? autor.cpf,
        cargoRespondente: dto.cargoRespondente ?? autor.cargo ?? null,
        emailRespondente: dto.emailRespondente ?? autor.email,
        telefoneRespondente: dto.telefoneRespondente ?? autor.telefone ?? null,
        ipResposta: ip ?? null,
        userAgent: userAgent ?? null,
        status: enviar ? SubmissaoStatus.ENVIADA : SubmissaoStatus.RASCUNHO,
        dados: dto.dados as object,
        enviadoEm: enviar ? new Date() : null,
      },
      include: { municipio: { select: { nome: true } } },
    });

    return submissao;
  }

  // ----------------------------------------------------------------- listar --

  async listar(
    paginacao: PaginacaoDto,
    filtros: {
      competenciaId?: string;
      formularioVersaoId?: string;
      municipioId?: number;
      status?: SubmissaoStatus;
    },
    usuario: JwtPayload,
  ) {
    const pagina = paginacao.pagina ?? 1;
    const porPagina = paginacao.porPagina ?? 20;
    const skip = (pagina - 1) * porPagina;

    const where: Prisma.SubmissaoWhereInput = {
      ...(filtros.competenciaId ? { competenciaId: filtros.competenciaId } : {}),
      ...(filtros.formularioVersaoId ? { formularioVersaoId: filtros.formularioVersaoId } : {}),
      ...(filtros.municipioId ? { municipioId: filtros.municipioId } : {}),
      ...(filtros.status ? { status: filtros.status } : {}),
    };

    // Escopo multi-tenant: operador municipal vê apenas seu município
    if (usuario.escopo === 'MUNICIPAL' && usuario.municipioId) {
      where.municipioId = usuario.municipioId;
    } else if (usuario.escopo === 'REGIONAL' && usuario.regionalId) {
      where.municipio = { regionalId: usuario.regionalId };
    }

    const [items, total] = await Promise.all([
      this.prisma.submissao.findMany({
        where,
        skip,
        take: porPagina,
        orderBy: { criadoEm: 'desc' },
        include: {
          municipio: { select: { nome: true } },
          formularioVersao: {
            select: { versao: true, formulario: { select: { nome: true } } },
          },
          _count: { select: { revisoes: true } },
        },
      }),
      this.prisma.submissao.count({ where }),
    ]);

    return { items, total, pagina, porPagina, totalPaginas: Math.ceil(total / porPagina) };
  }

  // --------------------------------------------------------------- buscar id --

  async buscarPorId(id: string, usuario: JwtPayload) {
    const sub = await this.prisma.submissao.findUnique({
      where: { id },
      include: {
        municipio: { select: { nome: true, uf: { select: { sigla: true } } } },
        formularioVersao: {
          select: {
            versao: true,
            schema: true,
            formulario: { select: { nome: true } },
          },
        },
        competencia: { select: { nome: true, status: true } },
        autor: { select: { nome: true, email: true } },
        revisoes: { orderBy: { criadoEm: 'asc' }, include: { revisor: { select: { nome: true } } } },
      },
    });
    if (!sub) throw new NotFoundException('Submissão não encontrada.');
    this.verificarEscopo(sub, usuario);
    return sub;
  }

  // ---------------------------------------------------------------- atualizar --

  async atualizar(id: string, dto: AtualizarSubmissaoDto, usuario: JwtPayload) {
    const sub = await this.buscarPorId(id, usuario);
    if (sub.status !== SubmissaoStatus.RASCUNHO && sub.status !== SubmissaoStatus.CORRECAO_SOLICITADA) {
      throw new BadRequestException(
        `Só é possível editar submissões em RASCUNHO ou CORRECAO_SOLICITADA. Status: ${sub.status}`,
      );
    }
    return this.prisma.submissao.update({
      where: { id },
      data: { ...(dto.dados ? { dados: dto.dados as object } : {}) },
    });
  }

  // ------------------------------------------------------------------- enviar --

  async enviar(id: string, usuario: JwtPayload) {
    const sub = await this.buscarPorId(id, usuario);
    if (sub.status !== SubmissaoStatus.RASCUNHO) {
      throw new BadRequestException(`Status inválido para envio: ${sub.status}`);
    }

    const protocolo = await this.gerarProtocolo('MG', new Date().getFullYear());

    const atualizado = await this.prisma.submissao.update({
      where: { id },
      data: { status: SubmissaoStatus.ENVIADA, protocolo, enviadoEm: new Date() },
    });

    this.realtime.emitirStatusUpdate({
      municipioId: atualizado.municipioId,
      competenciaId: atualizado.competenciaId,
      status: 'RESPONDIDO',
      protocolo: atualizado.protocolo,
    });

    if (sub.emailRespondente) {
      void this.notificacoes.notificar({
        tipo: 'submissao_enviada',
        destinatario: sub.emailRespondente,
        nome: sub.nomeRespondente ?? '',
        protocolo: atualizado.protocolo,
      });
    }

    return atualizado;
  }

  // ------------------------------------------------- solicitar correção -------

  async solicitarCorrecao(id: string, dto: RevisaoDto, usuario: JwtPayload) {
    const sub = await this.buscarPorId(id, usuario);
    if (
      sub.status !== SubmissaoStatus.ENVIADA &&
      sub.status !== SubmissaoStatus.EM_ANALISE &&
      sub.status !== SubmissaoStatus.REVISADA
    ) {
      throw new BadRequestException(`Não é possível solicitar correção com status: ${sub.status}`);
    }
    return this.transicionar(sub, SubmissaoStatus.CORRECAO_SOLICITADA, RevisaoAcao.SOLICITOU_CORRECAO, dto.comentario, usuario.sub);
  }

  // ------------------------------------------------------------------ revisar --

  async revisar(id: string, dto: RevisaoDto, usuario: JwtPayload) {
    const sub = await this.buscarPorId(id, usuario);
    if (sub.status !== SubmissaoStatus.CORRECAO_SOLICITADA) {
      throw new BadRequestException(`Status inválido para revisão: ${sub.status}`);
    }
    return this.transicionar(sub, SubmissaoStatus.REVISADA, RevisaoAcao.REVISOU, dto.comentario, usuario.sub);
  }

  // ------------------------------------------------------------------ validar --

  async validar(id: string, dto: RevisaoDto, usuario: JwtPayload) {
    const sub = await this.buscarPorId(id, usuario);
    if (sub.status !== SubmissaoStatus.ENVIADA && sub.status !== SubmissaoStatus.REVISADA) {
      throw new BadRequestException(`Status inválido para validação: ${sub.status}`);
    }
    return this.transicionar(sub, SubmissaoStatus.VALIDADA, RevisaoAcao.VALIDOU, dto.comentario, usuario.sub);
  }

  // ------------------------------------------------------------------ rejeitar --

  async rejeitar(id: string, dto: RevisaoDto, usuario: JwtPayload) {
    const sub = await this.buscarPorId(id, usuario);
    if (sub.status === SubmissaoStatus.VALIDADA || sub.status === SubmissaoStatus.RASCUNHO) {
      throw new BadRequestException(`Não é possível rejeitar uma submissão com status: ${sub.status}`);
    }
    return this.transicionar(sub, SubmissaoStatus.REJEITADA, RevisaoAcao.REJEITOU, dto.comentario, usuario.sub);
  }

  // ------------------------------------------------------------------ helpers --

  private async transicionar(
    sub: { id: string; dados: unknown; municipioId: number; competenciaId: string; emailRespondente: string | null; nomeRespondente: string | null },
    novoStatus: SubmissaoStatus,
    acao: RevisaoAcao,
    comentario: string | undefined,
    revisorId: string,
  ) {
    const atualizado = await this.prisma.$transaction(async (tx) => {
      await tx.revisaoSubmissao.create({
        data: {
          submissaoId: sub.id,
          revisorId,
          acao,
          comentario: comentario ?? null,
          dadosSnapshot: sub.dados as object,
        },
      });
      return tx.submissao.update({
        where: { id: sub.id },
        data: {
          status: novoStatus,
          ...(novoStatus === SubmissaoStatus.VALIDADA ? { validadoEm: new Date() } : {}),
        },
      });
    });

    // Emit evento WebSocket para o painel em tempo real
    const statusMapa =
      novoStatus === SubmissaoStatus.RASCUNHO
        ? 'EM_PREENCHIMENTO'
        : novoStatus === SubmissaoStatus.REJEITADA
        ? 'NAO_RESPONDEU'
        : 'RESPONDIDO';

    this.realtime.emitirStatusUpdate({
      municipioId: sub.municipioId,
      competenciaId: sub.competenciaId,
      status: statusMapa as 'RESPONDIDO' | 'EM_PREENCHIMENTO' | 'NAO_RESPONDEU',
    });

    const tipoNotificacao =
      acao === RevisaoAcao.SOLICITOU_CORRECAO
        ? 'correcao_solicitada' as const
        : acao === RevisaoAcao.VALIDOU
        ? 'submissao_validada' as const
        : acao === RevisaoAcao.REJEITOU
        ? 'submissao_rejeitada' as const
        : null;

    if (tipoNotificacao && sub.emailRespondente) {
      void this.notificacoes.notificar({
        tipo: tipoNotificacao,
        destinatario: sub.emailRespondente,
        nome: sub.nomeRespondente ?? '',
        protocolo: atualizado.protocolo,
        observacao: comentario,
      });
    }

    return atualizado;
  }

  private verificarEscopo(
    sub: { municipioId: number; autorId: string },
    usuario: JwtPayload,
  ) {
    if (usuario.escopo === 'MUNICIPAL') {
      if (sub.municipioId !== usuario.municipioId && sub.autorId !== usuario.sub) {
        throw new ForbiddenException('Acesso negado a esta submissão.');
      }
    }
  }

  private async gerarProtocolo(ufSigla: string, ano: number): Promise<string> {
    const seq = await this.prisma.protocoloSequencia.upsert({
      where: { ufSigla_ano: { ufSigla, ano } },
      update: { ultimoNumero: { increment: 1 } },
      create: { ufSigla, ano, ultimoNumero: 1 },
    });
    return `${ufSigla}-${ano}-${String(seq.ultimoNumero).padStart(8, '0')}`;
  }
}
