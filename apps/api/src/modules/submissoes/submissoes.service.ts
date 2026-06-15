import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompetenciaStatus,
  FonteAutomatica,
  FormularioStatus,
  Prisma,
  SubmissaoStatus,
  TipoPergunta,
} from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { FormulariosService } from '../formularios/formularios.service';
import { StorageService } from '../../infra/storage/storage.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import type { PaginacaoDto } from '../../common/dto/paginacao.dto';
import type { JwtPayload } from '../../common/types/jwt-payload';
import type { CriarSubmissaoDto } from './dto/criar-submissao.dto';
import type { AtualizarSubmissaoDto } from './dto/atualizar-submissao.dto';
import type { RevisaoDto } from './dto/revisao.dto';

type StatusMapa = 'RESPONDIDO' | 'EM_PREENCHIMENTO' | 'NAO_RESPONDEU';

/** MIME types aceitos para anexos de submissão. */
const MIME_ANEXO_PERMITIDOS = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
  'application/vnd.ms-excel',
  'application/zip',
  'application/x-zip-compressed',
  'image/png',
  'image/jpeg',
  // Geoespaciais
  'application/vnd.google-earth.kml+xml', // KML
  'application/vnd.google-earth.kmz',     // KMZ
  'application/xml',                       // KML via content-type genérico
  'text/xml',                              // KML via content-type texto
  'application/json',                      // GeoJSON / JSON
  'application/octet-stream',              // SHP (sem MIME padrão)
  'application/x-shapefile',               // SHP alternativo
]);
const EXT_ANEXO_PERMITIDAS = [
  '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.zip', '.png', '.jpg', '.jpeg',
  // Geoespaciais
  '.kml', '.kmz', '.json', '.geojson', '.shp', '.dbf', '.shx', '.prj',
];

@Injectable()
export class SubmissoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly notificacoes: NotificacoesService,
    private readonly formularios: FormulariosService,
    private readonly storage: StorageService,
  ) {}

  // ------------------------------------------------------------------ criar --

  async criar(dto: CriarSubmissaoDto, usuario: JwtPayload, ip?: string, userAgent?: string) {
    const autor = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuario.sub },
      select: { nome: true, cpf: true, cargo: true, email: true, telefone: true },
    });

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

    const municipio = await this.prisma.municipio.findUnique({
      where: { id: dto.municipioId },
      select: { nome: true },
    });

    const enviar = dto.enviarImediatamente === true;
    const protocolo = enviar
      ? await this.gerarProtocolo('MG', new Date().getFullYear())
      : `RASCUNHO-${usuario.sub.slice(0, 8)}-${Date.now()}`;

    // Mescla os valores AUTOMATICO resolvidos no servidor sobre os dados enviados.
    const automaticos = await this.resolverAutomaticos(dto.formularioVersaoId, {
      municipioId: dto.municipioId,
      municipioNome: municipio?.nome ?? '',
      autorNome: autor.nome,
      competenciaNome: competencia.nome,
      protocolo: enviar ? protocolo : '',
    });
    const dados = { ...dto.dados, ...automaticos };

    const status = enviar
      ? SubmissaoStatus.ENVIADO
      : Object.keys(dto.dados).length > 0
        ? SubmissaoStatus.EM_PREENCHIMENTO
        : SubmissaoStatus.RASCUNHO;

    const submissao = await this.prisma.$transaction(async (tx) => {
      const nova = await tx.submissao.create({
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
          status,
          enviadoEm: enviar ? new Date() : null,
        },
      });
      await this.sincronizarRespostas(tx, nova.id, dto.formularioVersaoId, dados);
      return nova;
    });

    if (enviar) {
      this.emitirStatus(submissao.municipioId, submissao.competenciaId, 'RESPONDIDO', submissao.protocolo);
      this.notificar('submissao_enviada', submissao);
    }

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

    if (usuario.escopo === 'MUNICIPAL' && usuario.municipioId) {
      where.municipioId = usuario.municipioId;
    } else if (usuario.escopo === 'REGIONAL' && usuario.regionalId) {
      where.municipio = { regionalId: usuario.regionalId };
    }

    // Usuários abaixo de ADMIN_MUNICIPAL (nivel < 50) só visualizam as próprias submissões.
    if (usuario.perfilNivel < 50) {
      where.autorId = usuario.sub;
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
          _count: { select: { historico: true, anexos: true } },
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
          select: { id: true, versao: true, formulario: { select: { nome: true } } },
        },
        competencia: { select: { nome: true, status: true } },
        autor: { select: { nome: true, email: true } },
        respostas: { select: { perguntaCodigo: true, valor: true } },
        historico: {
          orderBy: { criadoEm: 'asc' },
          include: { autor: { select: { nome: true } } },
        },
        anexos: { include: { arquivo: true }, orderBy: { criadoEm: 'desc' } },
      },
    });
    if (!sub) throw new NotFoundException('Submissão não encontrada.');
    this.verificarEscopo(sub, usuario);

    const schema = await this.formularios.comporSchema(sub.formularioVersaoId);
    const dados: Record<string, unknown> = {};
    for (const r of sub.respostas) dados[r.perguntaCodigo] = r.valor;

    return { ...sub, schema, dados };
  }

  // ---------------------------------------------------------------- atualizar --

  async atualizar(id: string, dto: AtualizarSubmissaoDto, usuario: JwtPayload) {
    const sub = await this.carregarParaEscopo(id, usuario);
    if (
      sub.status !== SubmissaoStatus.RASCUNHO &&
      sub.status !== SubmissaoStatus.EM_PREENCHIMENTO &&
      sub.status !== SubmissaoStatus.CORRECAO_SOLICITADA
    ) {
      throw new BadRequestException(
        `Só é possível editar submissões em RASCUNHO, EM_PREENCHIMENTO ou CORRECAO_SOLICITADA. Status: ${sub.status}`,
      );
    }
    if (!dto.dados) return sub;

    const snapshot = await this.lerDados(this.prisma, id);

    return this.prisma.$transaction(async (tx) => {
      await tx.respostaHistorico.create({
        data: {
          submissaoId: id,
          autorId: usuario.sub,
          acao: 'EDITOU',
          statusAnterior: sub.status,
          statusNovo: sub.status === SubmissaoStatus.RASCUNHO ? SubmissaoStatus.EM_PREENCHIMENTO : sub.status,
          snapshot: snapshot as Prisma.InputJsonValue,
        },
      });
      await this.sincronizarRespostas(tx, id, sub.formularioVersaoId, dto.dados!);
      return tx.submissao.update({
        where: { id },
        data: sub.status === SubmissaoStatus.RASCUNHO ? { status: SubmissaoStatus.EM_PREENCHIMENTO } : {},
      });
    });
  }

  // ------------------------------------------------------------------- enviar --

  async enviar(id: string, usuario: JwtPayload) {
    const sub = await this.carregarParaEscopo(id, usuario);
    if (sub.status !== SubmissaoStatus.RASCUNHO && sub.status !== SubmissaoStatus.EM_PREENCHIMENTO) {
      throw new BadRequestException(`Status inválido para envio: ${sub.status}`);
    }

    const protocolo = await this.gerarProtocolo('MG', new Date().getFullYear());

    // Recalcula AUTOMATICO agora que protocolo/competência são conhecidos.
    const ctx = await this.contextoAutomatico(sub.id);
    const automaticos = await this.resolverAutomaticos(sub.formularioVersaoId, { ...ctx, protocolo });
    const snapshot = await this.lerDados(this.prisma, id);

    const atualizado = await this.prisma.$transaction(async (tx) => {
      await this.upsertRespostas(tx, id, sub.formularioVersaoId, automaticos);
      await tx.respostaHistorico.create({
        data: {
          submissaoId: id,
          autorId: usuario.sub,
          acao: 'ENVIOU',
          statusAnterior: sub.status,
          statusNovo: SubmissaoStatus.ENVIADO,
          snapshot: snapshot as Prisma.InputJsonValue,
        },
      });
      return tx.submissao.update({
        where: { id },
        data: { status: SubmissaoStatus.ENVIADO, protocolo, enviadoEm: new Date() },
      });
    });

    this.emitirStatus(atualizado.municipioId, atualizado.competenciaId, 'RESPONDIDO', atualizado.protocolo);
    this.notificar('submissao_enviada', atualizado);
    return atualizado;
  }

  // ------------------------------------------------- solicitar correção -------

  async solicitarCorrecao(id: string, dto: RevisaoDto, usuario: JwtPayload) {
    const sub = await this.carregarParaEscopo(id, usuario);
    if (sub.status !== SubmissaoStatus.ENVIADO && sub.status !== SubmissaoStatus.REVISADO) {
      throw new BadRequestException(`Não é possível solicitar correção com status: ${sub.status}`);
    }
    return this.transicionar(sub, SubmissaoStatus.CORRECAO_SOLICITADA, 'SOLICITOU_CORRECAO', dto.comentario, usuario.sub);
  }

  // ------------------------------------------------------------------ revisar --

  async revisar(id: string, dto: RevisaoDto, usuario: JwtPayload) {
    const sub = await this.carregarParaEscopo(id, usuario);
    if (sub.status !== SubmissaoStatus.CORRECAO_SOLICITADA) {
      throw new BadRequestException(`Status inválido para revisão: ${sub.status}`);
    }
    return this.transicionar(sub, SubmissaoStatus.REVISADO, 'REVISOU', dto.comentario, usuario.sub);
  }

  // ------------------------------------------------------------------ aprovar --

  async aprovar(id: string, dto: RevisaoDto, usuario: JwtPayload) {
    const sub = await this.carregarParaEscopo(id, usuario);
    if (sub.status !== SubmissaoStatus.ENVIADO && sub.status !== SubmissaoStatus.REVISADO) {
      throw new BadRequestException(`Status inválido para aprovação: ${sub.status}`);
    }
    return this.transicionar(sub, SubmissaoStatus.APROVADO, 'APROVOU', dto.comentario, usuario.sub);
  }

  // ------------------------------------------------------------------- anexos --

  async listarAnexos(id: string, usuario: JwtPayload) {
    await this.carregarParaEscopo(id, usuario);
    return this.prisma.anexoSubmissao.findMany({
      where: { submissaoId: id },
      include: { arquivo: true },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async adicionarAnexo(
    id: string,
    arquivo: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    usuario: JwtPayload,
    perguntaCodigo?: string,
  ) {
    await this.carregarParaEscopo(id, usuario);
    if (!arquivo) throw new BadRequestException('Arquivo obrigatório.');

    const ext = arquivo.originalname.slice(arquivo.originalname.lastIndexOf('.')).toLowerCase();
    const mimeOk = MIME_ANEXO_PERMITIDOS.has(arquivo.mimetype);
    const extOk = EXT_ANEXO_PERMITIDAS.includes(ext);
    if (!mimeOk && !extOk) {
      throw new BadRequestException('Tipo de arquivo não permitido. Aceitos: PDF, DOCX, XLSX, ZIP, PNG, JPG.');
    }

    const maxMb = 25;
    if (arquivo.size > maxMb * 1024 * 1024) {
      throw new BadRequestException(`Arquivo excede o limite de ${maxMb} MB.`);
    }

    const arq = await this.storage.salvar(arquivo.buffer, arquivo.originalname, arquivo.mimetype);
    return this.prisma.anexoSubmissao.create({
      data: { submissaoId: id, arquivoId: arq.id, perguntaCodigo: perguntaCodigo ?? null },
      include: { arquivo: true },
    });
  }

  async excluir(id: string, usuario: JwtPayload) {
    const sub = await this.carregarParaEscopo(id, usuario);

    const podeExcluirQualquer = usuario.perfilNivel >= 80;
    const statusPermitidos: string[] = [SubmissaoStatus.RASCUNHO, SubmissaoStatus.EM_PREENCHIMENTO];

    if (!podeExcluirQualquer && !statusPermitidos.includes(sub.status)) {
      throw new BadRequestException(
        `Submissões com status "${sub.status}" não podem ser excluídas. Apenas RASCUNHO e EM_PREENCHIMENTO são permitidos.`,
      );
    }

    await this.prisma.submissao.delete({ where: { id } });
  }

  async removerAnexo(id: string, anexoId: string, usuario: JwtPayload) {
    await this.carregarParaEscopo(id, usuario);
    const anexo = await this.prisma.anexoSubmissao.findUnique({
      where: { id: anexoId },
      include: { arquivo: true },
    });
    if (!anexo || anexo.submissaoId !== id) {
      throw new NotFoundException('Anexo não encontrado nesta submissão.');
    }
    await this.prisma.anexoSubmissao.delete({ where: { id: anexoId } });
    await this.storage.deletar(anexo.arquivo.chave);
  }

  // ------------------------------------------------------------------ helpers --

  private async transicionar(
    sub: { id: string; municipioId: number; competenciaId: string; status: SubmissaoStatus; emailRespondente: string | null; nomeRespondente: string; protocolo: string },
    novoStatus: SubmissaoStatus,
    acao: string,
    comentario: string | undefined,
    autorId: string,
  ) {
    const snapshot = await this.lerDados(this.prisma, sub.id);

    const atualizado = await this.prisma.$transaction(async (tx) => {
      await tx.respostaHistorico.create({
        data: {
          submissaoId: sub.id,
          autorId,
          acao,
          comentario: comentario ?? null,
          statusAnterior: sub.status,
          statusNovo: novoStatus,
          snapshot: snapshot as Prisma.InputJsonValue,
        },
      });
      return tx.submissao.update({
        where: { id: sub.id },
        data: {
          status: novoStatus,
          ...(novoStatus === SubmissaoStatus.APROVADO ? { aprovadoEm: new Date() } : {}),
        },
      });
    });

    this.emitirStatus(sub.municipioId, sub.competenciaId, this.statusMapa(novoStatus));

    if (acao === 'SOLICITOU_CORRECAO') this.notificar('correcao_solicitada', atualizado, comentario);
    if (acao === 'APROVOU') this.notificar('submissao_aprovada', atualizado);

    return atualizado;
  }

  private statusMapa(status: SubmissaoStatus): StatusMapa {
    if (status === SubmissaoStatus.RASCUNHO || status === SubmissaoStatus.EM_PREENCHIMENTO) {
      return 'EM_PREENCHIMENTO';
    }
    return 'RESPONDIDO';
  }

  private emitirStatus(municipioId: number, competenciaId: string, status: StatusMapa, protocolo?: string) {
    this.realtime.emitirStatusUpdate({ municipioId, competenciaId, status, protocolo });
  }

  private notificar(
    tipo: 'submissao_enviada' | 'correcao_solicitada' | 'submissao_aprovada',
    sub: { emailRespondente: string | null; nomeRespondente: string; protocolo: string },
    observacao?: string,
  ) {
    if (!sub.emailRespondente) return;
    void this.notificacoes.notificar({
      tipo,
      destinatario: sub.emailRespondente,
      nome: sub.nomeRespondente ?? '',
      protocolo: sub.protocolo,
      observacao,
    });
  }

  private verificarEscopo(sub: { municipioId: number; autorId: string }, usuario: JwtPayload) {
    if (usuario.escopo === 'MUNICIPAL') {
      if (sub.municipioId !== usuario.municipioId && sub.autorId !== usuario.sub) {
        throw new ForbiddenException('Acesso negado a esta submissão.');
      }
    }
  }

  private async carregarParaEscopo(id: string, usuario: JwtPayload) {
    const sub = await this.prisma.submissao.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Submissão não encontrada.');
    this.verificarEscopo(sub, usuario);
    return sub;
  }

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

  /** Contexto para resolução de campos AUTOMATICO a partir de uma submissão. */
  private async contextoAutomatico(submissaoId: string) {
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

  /** Calcula os valores das perguntas AUTOMATICO da versão. */
  private async resolverAutomaticos(
    versaoId: string,
    ctx: { municipioId: number; municipioNome: string; autorNome: string; competenciaNome: string; protocolo: string },
  ): Promise<Record<string, unknown>> {
    const perguntas = await this.prisma.pergunta.findMany({
      where: { secao: { pagina: { versaoId } }, tipo: TipoPergunta.AUTOMATICO },
      select: { codigo: true, fonteAutomatica: true },
    });

    const agora = new Date();
    const valores: Record<string, unknown> = {};
    for (const p of perguntas) {
      switch (p.fonteAutomatica) {
        case FonteAutomatica.CODIGO_IBGE:
          valores[p.codigo] = ctx.municipioId;
          break;
        case FonteAutomatica.MUNICIPIO_ATUAL:
          valores[p.codigo] = ctx.municipioNome;
          break;
        case FonteAutomatica.USUARIO_ATUAL:
          valores[p.codigo] = ctx.autorNome;
          break;
        case FonteAutomatica.DATA_ATUAL:
          valores[p.codigo] = agora.toISOString().slice(0, 10);
          break;
        case FonteAutomatica.ANO_ATUAL:
          valores[p.codigo] = agora.getFullYear();
          break;
        case FonteAutomatica.COMPETENCIA_ATUAL:
          valores[p.codigo] = ctx.competenciaNome;
          break;
        case FonteAutomatica.PROTOCOLO:
          valores[p.codigo] = ctx.protocolo;
          break;
        default:
          break;
      }
    }
    return valores;
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
