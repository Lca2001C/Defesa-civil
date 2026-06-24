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
  Submissao,
  SubmissaoStatus,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { FormulariosService } from '../../formularios/services/formularios.service';
import { StorageService } from '../../../infra/storage/storage.service';
import { NotificacoesService } from '../../notificacoes/services/notificacoes.service';
import { CacheService } from '../../../infra/cache/cache.service';
import { prefixoCachePainel } from '../../painel/services/painel.service';
import { PERMISSION_LEVEL } from '../../../shared/constants';
import type { Env } from '../../../config/env.validation';
import type { PaginacaoDto } from '../../../common/dto/paginacao.dto';
import type { JwtPayload } from '../../../common/types/jwt-payload';
import { AuditoriaService } from '../../auditoria/services/auditoria.service';
import { SubmissoesRepository } from '../repositories/submissoes.repository';
import { SubmissaoExportService, type DetalheExport } from './submissao-export.service';
import { tipoArquivoPermitido } from '../validators/anexo.validator';
import type { CriarSubmissaoDto } from '../dtos/criar-submissao.dto';
import type { AtualizarSubmissaoDto } from '../dtos/atualizar-submissao.dto';
import type { RevisaoDto } from '../dtos/revisao.dto';
import type { IniciarAnexoDto, CompletarAnexoDto } from '../dtos/anexo-multipart.dto';
import type { FiltrosSubmissao } from '../utils/submissoes-where.util';

interface ContextoAutomatico {
  municipioId: number;
  municipioNome: string;
  autorNome: string;
  competenciaNome: string;
  protocolo: string;
}

const UF_PADRAO = 'MG';

@Injectable()
export class SubmissoesService {
  constructor(
    private readonly repo: SubmissoesRepository,
    private readonly notificacoes: NotificacoesService,
    private readonly formularios: FormulariosService,
    private readonly storage: StorageService,
    private readonly cache: CacheService,
    private readonly exportService: SubmissaoExportService,
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Limite de upload em bytes (MAX_UPLOAD_MB). */
  private get maxUploadBytes(): number {
    return this.config.get('MAX_UPLOAD_MB', { infer: true }) * 1024 * 1024;
  }

  // ------------------------------------------------------------------ criar --

  async criar(
    dto: CriarSubmissaoDto,
    usuario: JwtPayload,
    ip?: string,
    userAgent?: string,
  ): Promise<Submissao> {
    const autor = await this.repo.buscarAutor(usuario.sub);
    await this.validarMunicipioNoEscopo(dto.municipioId, usuario);
    await this.validarVersaoPublicada(dto.formularioVersaoId);
    const competencia = await this.validarCompetenciaAberta(dto.competenciaId);

    const enviar = dto.enviarImediatamente === true;
    const protocolo = enviar
      ? await this.repo.gerarProtocolo(UF_PADRAO, new Date().getFullYear())
      : `RASCUNHO-${usuario.sub.slice(0, 8)}-${Date.now()}`;

    const dados = await this.mesclarAutomaticos(dto, autor.nome, competencia.nome, protocolo, enviar);
    const status = this.statusInicial(enviar, dto.dados);

    const submissao = await this.repo.criarComRespostas(
      {
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
      dados,
    );

    if (enviar) {
      this.invalidarCachePainel(submissao.competenciaId);
      this.notificar('submissao_enviada', submissao);
    }
    return submissao;
  }

  private async validarVersaoPublicada(versaoId: string): Promise<void> {
    const versao = await this.repo.buscarVersao(versaoId);
    if (!versao) throw new NotFoundException('Versão do formulário não encontrada.');
    if (versao.status !== FormularioStatus.PUBLICADO) {
      throw new BadRequestException('A versão do formulário precisa estar PUBLICADA.');
    }
  }

  private async validarCompetenciaAberta(id: string) {
    const competencia = await this.repo.buscarCompetencia(id);
    if (!competencia) throw new NotFoundException('Competência não encontrada.');
    if (competencia.status !== CompetenciaStatus.ABERTA) {
      throw new BadRequestException('A competência precisa estar ABERTA para enviar respostas.');
    }
    return competencia;
  }

  private async mesclarAutomaticos(
    dto: CriarSubmissaoDto,
    autorNome: string,
    competenciaNome: string,
    protocolo: string,
    enviar: boolean,
  ): Promise<Record<string, unknown>> {
    const municipioNome = await this.repo.buscarMunicipioNome(dto.municipioId);
    const automaticos = await this.resolverAutomaticos(dto.formularioVersaoId, {
      municipioId: dto.municipioId,
      municipioNome: municipioNome ?? '',
      autorNome,
      competenciaNome,
      protocolo: enviar ? protocolo : '',
    });
    return { ...dto.dados, ...automaticos };
  }

  private statusInicial(enviar: boolean, dados: Record<string, unknown>): SubmissaoStatus {
    if (enviar) return SubmissaoStatus.ENVIADO;
    return Object.keys(dados).length > 0
      ? SubmissaoStatus.EM_PREENCHIMENTO
      : SubmissaoStatus.RASCUNHO;
  }

  // ----------------------------------------------------------------- listar --

  async listar(paginacao: PaginacaoDto, filtros: FiltrosSubmissao, usuario: JwtPayload) {
    const pagina = paginacao.pagina ?? 1;
    const porPagina = paginacao.porPagina ?? 20;
    const { items, total } = await this.repo.listar(filtros, usuario, (pagina - 1) * porPagina, porPagina);
    return { items, total, pagina, porPagina, totalPaginas: Math.ceil(total / porPagina) };
  }

  // --------------------------------------------------------------- buscar id --

  async buscarPorId(id: string, usuario: JwtPayload) {
    const sub = await this.repo.buscarDetalhe(id);
    if (!sub) throw new NotFoundException('Submissão não encontrada.');
    this.verificarEscopo(sub, usuario);

    // Buscamos os 30 mais recentes (desc); reordenamos asc para exibição cronológica.
    const historico = [...sub.historico].reverse();
    const schema = await this.formularios.comporSchema(sub.formularioVersaoId);
    const dados: Record<string, unknown> = {};
    for (const r of sub.respostas) dados[r.perguntaCodigo] = r.valor;

    return { ...sub, historico, schema, dados };
  }

  // -------------------------------------------------------------- exportar --

  /** Gera o documento (PDF ou Excel) de uma submissão para download. */
  async exportar(
    id: string,
    formato: 'pdf' | 'xlsx',
    usuario: JwtPayload,
    origem: { ip?: string | null; userAgent?: string | null } = {},
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    if (formato !== 'pdf' && formato !== 'xlsx') {
      throw new BadRequestException('Formato inválido. Use "pdf" ou "xlsx".');
    }

    const detalhe = (await this.buscarPorId(id, usuario)) as unknown as DetalheExport & {
      protocolo: string | null;
    };
    const base = `submissao_${(detalhe.protocolo ?? id).replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    void this.auditoria.registrar({
      atorId: usuario.sub,
      acao: `EXPORT_${formato.toUpperCase()}`,
      entidade: 'submissoes',
      entidadeId: id,
      ip: origem.ip,
      userAgent: origem.userAgent,
    });

    if (formato === 'pdf') {
      return {
        buffer: await this.exportService.gerarPdf(detalhe),
        filename: `${base}.pdf`,
        mimeType: 'application/pdf',
      };
    }
    return {
      buffer: await this.exportService.gerarExcel(detalhe),
      filename: `${base}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
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

    return this.repo.atualizarComHistorico(id, sub.formularioVersaoId, dto.dados, sub.status, usuario.sub);
  }

  // ------------------------------------------------------------------- enviar --

  async enviar(id: string, usuario: JwtPayload) {
    const sub = await this.carregarParaEscopo(id, usuario);
    if (sub.status !== SubmissaoStatus.RASCUNHO && sub.status !== SubmissaoStatus.EM_PREENCHIMENTO) {
      throw new BadRequestException(`Status inválido para envio: ${sub.status}`);
    }

    const protocolo = await this.repo.gerarProtocolo(UF_PADRAO, new Date().getFullYear());

    // Recalcula AUTOMATICO agora que protocolo/competência são conhecidos.
    const ctx = await this.repo.contextoAutomatico(sub.id);
    const automaticos = await this.resolverAutomaticos(sub.formularioVersaoId, { ...ctx, protocolo });

    const atualizado = await this.repo.enviarComHistorico(
      id,
      sub.formularioVersaoId,
      automaticos,
      sub.status,
      usuario.sub,
      protocolo,
    );

    this.invalidarCachePainel(atualizado.competenciaId);
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
    return this.repo.listarAnexos(id);
  }

  /** Upload legado (via servidor, em memória) — usado no modo local/dev. */
  async adicionarAnexo(
    id: string,
    arquivo: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    usuario: JwtPayload,
    perguntaCodigo?: string,
  ) {
    await this.carregarParaEscopo(id, usuario);
    if (!arquivo) throw new BadRequestException('Arquivo obrigatório.');

    if (!tipoArquivoPermitido(arquivo.originalname, arquivo.mimetype)) {
      throw new BadRequestException('Tipo de arquivo não permitido.');
    }
    if (arquivo.size > this.maxUploadBytes) {
      throw new BadRequestException(
        `Arquivo excede o limite de ${this.config.get('MAX_UPLOAD_MB', { infer: true })} MB.`,
      );
    }

    const arq = await this.storage.salvar(arquivo.buffer, arquivo.originalname, arquivo.mimetype);
    return this.repo.criarAnexo(id, arq.id, perguntaCodigo ?? null);
  }

  // ── Upload direto ao Azure Blob (SAS, PUT único) ───────────────────────────

  /** Etapa 1: valida e devolve a URL SAS de escrita (ou modo local em dev). */
  async iniciarAnexo(id: string, dto: IniciarAnexoDto, usuario: JwtPayload) {
    await this.carregarParaEscopo(id, usuario);

    if (!tipoArquivoPermitido(dto.nomeOriginal, dto.mimeType)) {
      throw new BadRequestException('Tipo de arquivo não permitido.');
    }
    if (dto.tamanhoBytes > this.maxUploadBytes) {
      throw new BadRequestException(
        `Arquivo excede o limite de ${this.config.get('MAX_UPLOAD_MB', { infer: true })} MB.`,
      );
    }

    if (!this.storage.suportaUploadDireto) {
      return { modo: 'local' as const };
    }

    const { chave, url } = await this.storage.gerarUploadUrl(dto.nomeOriginal, dto.mimeType);
    // Registra a chave emitida para ESTA submissão; só ela poderá ser concluída
    // depois (impede o cliente de registrar um blob arbitrário). TTL > SAS (15min).
    await this.cache.cacheSet(this.chaveAnexoEmitida(id, chave), dto.nomeOriginal, 1200);
    return { modo: 'azure' as const, chave, url };
  }

  /** Etapa 2: após o PUT direto no Blob, registra o anexo no banco. */
  async completarAnexo(id: string, dto: CompletarAnexoDto, usuario: JwtPayload) {
    await this.carregarParaEscopo(id, usuario);

    if (!tipoArquivoPermitido(dto.nomeOriginal, dto.mimeType)) {
      throw new BadRequestException('Tipo de arquivo não permitido.');
    }

    // A chave precisa ter sido emitida por iniciarAnexo PARA ESTA submissão.
    const emitida = await this.cache.cacheGet<string>(this.chaveAnexoEmitida(id, dto.chave));
    if (!emitida) {
      throw new BadRequestException('Upload inválido ou expirado. Reinicie o envio do anexo.');
    }

    // NÃO confia no tamanho enviado pelo cliente: lê o blob real.
    const stat = await this.storage.statBlob(dto.chave);
    if (!stat) {
      throw new BadRequestException('O arquivo não foi encontrado no storage. Refaça o upload.');
    }
    if (stat.tamanhoBytes > this.maxUploadBytes) {
      // Remove o blob que excede o limite e recusa.
      await this.storage.deletar(dto.chave).catch(() => undefined);
      throw new BadRequestException(
        `Arquivo excede o limite de ${this.config.get('MAX_UPLOAD_MB', { infer: true })} MB.`,
      );
    }

    const arq = await this.storage.registrarArquivo({
      chave: dto.chave,
      nomeOriginal: dto.nomeOriginal,
      mimeType: dto.mimeType,
      tamanhoBytes: stat.tamanhoBytes,
    });

    await this.cache.del(this.chaveAnexoEmitida(id, dto.chave));
    return this.repo.criarAnexo(id, arq.id, dto.perguntaCodigo ?? null);
  }

  private chaveAnexoEmitida(submissaoId: string, chave: string): string {
    return `anexo:emitida:${submissaoId}:${chave}`;
  }

  /** URL SAS de download do anexo — direto do Blob. */
  async urlDownloadAnexo(
    id: string,
    anexoId: string,
    usuario: JwtPayload,
    origem: { ip?: string | null; userAgent?: string | null } = {},
  ) {
    await this.carregarParaEscopo(id, usuario);
    const anexo = await this.repo.buscarAnexo(anexoId);
    if (!anexo || anexo.submissaoId !== id) {
      throw new NotFoundException('Anexo não encontrado nesta submissão.');
    }
    if (!this.storage.suportaUploadDireto) {
      throw new BadRequestException('Download direto disponível apenas com storage Azure.');
    }
    const url = await this.storage.assinarDownload(anexo.arquivo.chave, anexo.arquivo.nomeOriginal);

    void this.auditoria.registrar({
      atorId: usuario.sub,
      acao: 'DOWNLOAD',
      entidade: 'submissoes',
      entidadeId: anexoId,
      ip: origem.ip,
      userAgent: origem.userAgent,
    });

    return { url };
  }

  async excluir(id: string, usuario: JwtPayload) {
    const sub = await this.carregarParaEscopo(id, usuario);

    const podeExcluirQualquer = usuario.perfilNivel >= PERMISSION_LEVEL.GESTOR_ESTADUAL;
    const statusPermitidos: string[] = [SubmissaoStatus.RASCUNHO, SubmissaoStatus.EM_PREENCHIMENTO];

    if (!podeExcluirQualquer && !statusPermitidos.includes(sub.status)) {
      throw new BadRequestException(
        `Submissões com status "${sub.status}" não podem ser excluídas. Apenas RASCUNHO e EM_PREENCHIMENTO são permitidos.`,
      );
    }

    await this.repo.excluir(id);
  }

  async removerAnexo(id: string, anexoId: string, usuario: JwtPayload) {
    await this.carregarParaEscopo(id, usuario);
    const anexo = await this.repo.buscarAnexo(anexoId);
    if (!anexo || anexo.submissaoId !== id) {
      throw new NotFoundException('Anexo não encontrado nesta submissão.');
    }
    // Ordem importa pela FK: remove primeiro a linha Anexo (filha), depois o
    // blob + a linha Arquivo (pai, em storage.deletar). Se o delete do blob
    // falhar, sobra no máximo um blob órfão (coletável depois) — sem inconsistência.
    await this.repo.removerAnexo(anexoId);
    await this.storage.deletar(anexo.arquivo.chave);
  }

  // ------------------------------------------------------------------ helpers --

  private async transicionar(
    sub: {
      id: string;
      municipioId: number;
      competenciaId: string;
      status: SubmissaoStatus;
      emailRespondente: string | null;
      nomeRespondente: string;
      protocolo: string;
    },
    novoStatus: SubmissaoStatus,
    acao: string,
    comentario: string | undefined,
    autorId: string,
  ) {
    const atualizado = await this.repo.transicionarComHistorico(
      sub.id,
      sub.status,
      novoStatus,
      acao,
      comentario,
      autorId,
    );

    this.invalidarCachePainel(sub.competenciaId);

    if (acao === 'SOLICITOU_CORRECAO') this.notificar('correcao_solicitada', atualizado, comentario);
    if (acao === 'APROVOU') this.notificar('submissao_aprovada', atualizado);

    return atualizado;
  }

  /**
   * Invalida o cache do painel desta competência (status/stats). O próximo
   * request do painel (via polling) recalcula com os dados atualizados.
   */
  private invalidarCachePainel(competenciaId: string) {
    void this.cache.cacheDelPorPrefixo(prefixoCachePainel(competenciaId));
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
    // Escopo REGIONAL é verificado nos pontos que carregam o município
    // (validarMunicipioNoEscopo). Para leitura por ID, o where da listagem
    // já restringe; aqui o autor sempre acessa a própria submissão.
  }

  /**
   * Garante que o usuário pode operar sobre o município alvo (escrita).
   * MUNICIPAL: só o próprio município. REGIONAL: só municípios da sua regional.
   * Demais escopos (estaduais): sem restrição.
   */
  private async validarMunicipioNoEscopo(municipioId: number, usuario: JwtPayload): Promise<void> {
    if (usuario.escopo === 'MUNICIPAL') {
      if (municipioId !== usuario.municipioId) {
        throw new ForbiddenException('Você só pode criar submissões para o seu próprio município.');
      }
      return;
    }
    if (usuario.escopo === 'REGIONAL') {
      const regionalDoMunicipio = await this.repo.buscarRegionalDoMunicipio(municipioId);
      if (!regionalDoMunicipio || regionalDoMunicipio !== usuario.regionalId) {
        throw new ForbiddenException('Você só pode criar submissões para municípios da sua regional.');
      }
    }
  }

  private async carregarParaEscopo(id: string, usuario: JwtPayload) {
    const sub = await this.repo.buscarPorId(id);
    if (!sub) throw new NotFoundException('Submissão não encontrada.');
    this.verificarEscopo(sub, usuario);
    return sub;
  }

  /** Calcula os valores das perguntas AUTOMATICO da versão. */
  private async resolverAutomaticos(
    versaoId: string,
    ctx: ContextoAutomatico,
  ): Promise<Record<string, unknown>> {
    const perguntas = await this.repo.perguntasAutomaticas(versaoId);

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
}
