import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';

export type StatusMapa = 'RESPONDIDO' | 'EM_PREENCHIMENTO' | 'NAO_RESPONDEU';

const PRIORIDADE_STATUS: Record<string, number> = {
  APROVADO: 4,
  REVISADO: 3,
  ENVIADO: 3,
  CORRECAO_SOLICITADA: 2, // correção pendente → ainda em andamento, não "respondido"
  EM_PREENCHIMENTO: 1,
  RASCUNHO: 1,
};

const CACHE_TTL_SEG = 60;
/** Prefixo de cache do painel por competência (usado também na invalidação). */
export function prefixoCachePainel(competenciaId: string): string {
  return `painel:${competenciaId}:`;
}

function classificar(status: string): StatusMapa {
  const p = PRIORIDADE_STATUS[status] ?? 0;
  if (p >= 3) return 'RESPONDIDO';     // ENVIADO / REVISADO / APROVADO → verde
  if (p >= 1) return 'EM_PREENCHIMENTO'; // RASCUNHO / EM_PREENCHIMENTO / CORRECAO_SOLICITADA → amarelo
  return 'NAO_RESPONDEU';
}

@Injectable()
export class PainelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Retorna o status de cada município de MG para uma dada competência. */
  async buscarStatusMunicipios(
    competenciaId: string,
    formularioVersaoId?: string,
  ): Promise<{ municipioId: number; status: StatusMapa }[]> {
    const chave = `${prefixoCachePainel(competenciaId)}status:${formularioVersaoId ?? 'all'}`;
    const cacheado = await this.redis.cacheGet<{ municipioId: number; status: StatusMapa }[]>(chave);
    if (cacheado) return cacheado;

    // Agregação no banco: no máx. ~853×6 linhas, independente do total de submissões.
    const grupos = await this.prisma.submissao.groupBy({
      by: ['municipioId', 'status'],
      where: {
        competenciaId,
        ...(formularioVersaoId ? { formularioVersaoId } : {}),
        municipio: { ufId: 31 },
      },
    });

    // Mapa municipioId → melhor status (resolução de prioridade sobre o conjunto reduzido)
    const mapa = new Map<number, string>();
    for (const g of grupos) {
      const atual = mapa.get(g.municipioId);
      const priorAtual = PRIORIDADE_STATUS[atual ?? ''] ?? 0;
      const priorNovo = PRIORIDADE_STATUS[g.status] ?? 0;
      if (priorNovo > priorAtual) mapa.set(g.municipioId, g.status);
    }

    // Lista dos 853 municípios de MG (os não encontrados = NAO_RESPONDEU)
    const municipios = await this.listarMunicipiosMg();

    const resultado = municipios.map((id) => ({
      municipioId: id,
      status: mapa.has(id) ? classificar(mapa.get(id)!) : ('NAO_RESPONDEU' as StatusMapa),
    }));

    await this.redis.cacheSet(chave, resultado, CACHE_TTL_SEG);
    return resultado;
  }

  /** IDs dos municípios de MG (cacheados por tempo longo — mudam raramente). */
  private async listarMunicipiosMg(): Promise<number[]> {
    const chave = 'painel:municipios-mg';
    const cacheado = await this.redis.cacheGet<number[]>(chave);
    if (cacheado) return cacheado;

    const municipios = await this.prisma.municipio.findMany({
      where: { ufId: 31 },
      select: { id: true },
    });
    const ids = municipios.map((m) => m.id);
    await this.redis.cacheSet(chave, ids, 3600);
    return ids;
  }

  /** Estatísticas agregadas: contadores por status. */
  async buscarEstatisticas(competenciaId: string): Promise<{
    total: number;
    respondido: number;
    emPreenchimento: number;
    naoRespondeu: number;
    percentual: number;
  }> {
    const chave = `${prefixoCachePainel(competenciaId)}stats`;
    const cacheado = await this.redis.cacheGet<{
      total: number;
      respondido: number;
      emPreenchimento: number;
      naoRespondeu: number;
      percentual: number;
    }>(chave);
    if (cacheado) return cacheado;

    const statuses = await this.buscarStatusMunicipios(competenciaId);
    const total = statuses.length;
    const respondido = statuses.filter((s) => s.status === 'RESPONDIDO').length;
    const emPreenchimento = statuses.filter((s) => s.status === 'EM_PREENCHIMENTO').length;
    const naoRespondeu = total - respondido - emPreenchimento;
    const stats = {
      total,
      respondido,
      emPreenchimento,
      naoRespondeu,
      percentual: total > 0 ? Math.round((respondido / total) * 1000) / 10 : 0,
    };

    await this.redis.cacheSet(chave, stats, CACHE_TTL_SEG);
    return stats;
  }

  /** Dados do drawer: município + COMPDEC + submissões recentes. */
  async buscarDrawerMunicipio(municipioId: number, competenciaId: string) {
    const municipio = await this.prisma.municipio.findUnique({
      where: { id: municipioId },
      include: { compdec: true },
    });

    const submissoes = await this.prisma.submissao.findMany({
      where: { municipioId, competenciaId },
      orderBy: { criadoEm: 'desc' },
      take: 5,
      select: {
        id: true,
        protocolo: true,
        status: true,
        nomeRespondente: true,
        criadoEm: true,
      },
    });

    return {
      municipio: {
        id: municipio?.id ?? municipioId,
        nome: municipio?.nome ?? '',
        codigoIbge: String(municipio?.id ?? municipioId),
      },
      compdec: municipio?.compdec
        ? {
            coordenadorNome: municipio.compdec.coordenadorNome ?? undefined,
            telefone: municipio.compdec.telefone ?? undefined,
            email: municipio.compdec.email ?? undefined,
          }
        : null,
      submissoesRecentes: submissoes.map((s) => ({
        id: s.id,
        protocolo: s.protocolo ?? undefined,
        status: s.status,
        createdAt: s.criadoEm.toISOString(),
        nomeRespondente: s.nomeRespondente ?? undefined,
      })),
    };
  }
}
