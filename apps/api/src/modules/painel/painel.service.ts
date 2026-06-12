import { Injectable } from '@nestjs/common';
import { SubmissaoStatus } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

export type StatusMapa = 'RESPONDIDO' | 'EM_PREENCHIMENTO' | 'NAO_RESPONDEU';

const PRIORIDADE_STATUS: Record<string, number> = {
  APROVADO: 4,
  REVISADO: 3,
  ENVIADO: 3,
  CORRECAO_SOLICITADA: 2, // correção pendente → ainda em andamento, não "respondido"
  EM_PREENCHIMENTO: 1,
  RASCUNHO: 1,
};

function classificar(status: string): StatusMapa {
  const p = PRIORIDADE_STATUS[status] ?? 0;
  if (p >= 3) return 'RESPONDIDO';     // ENVIADO / REVISADO / APROVADO → verde
  if (p >= 1) return 'EM_PREENCHIMENTO'; // RASCUNHO / EM_PREENCHIMENTO / CORRECAO_SOLICITADA → amarelo
  return 'NAO_RESPONDEU';
}

@Injectable()
export class PainelService {
  constructor(private readonly prisma: PrismaService) {}

  /** Retorna o status de cada município de MG para uma dada competência. */
  async buscarStatusMunicipios(
    competenciaId: string,
    formularioVersaoId?: string,
  ): Promise<{ municipioId: number; status: StatusMapa }[]> {
    // Buscar todas as submissões da competência (só MG - ufId=31)
    const submissoes = await this.prisma.submissao.findMany({
      where: {
        competenciaId,
        ...(formularioVersaoId ? { formularioVersaoId } : {}),
        municipio: { ufId: 31 },
      },
      select: { municipioId: true, status: true },
    });

    // Mapa municipioId → melhor status
    const mapa = new Map<number, string>();
    for (const s of submissoes) {
      const atual = mapa.get(s.municipioId);
      const priorActual = PRIORIDADE_STATUS[atual ?? ''] ?? 0;
      const priorNovo = PRIORIDADE_STATUS[s.status] ?? 0;
      if (priorNovo > priorActual) {
        mapa.set(s.municipioId, s.status);
      }
    }

    // Retornar para TODOS os municípios de MG (os não encontrados = NAO_RESPONDEU)
    const municipios = await this.prisma.municipio.findMany({
      where: { ufId: 31 },
      select: { id: true },
    });

    return municipios.map((m) => ({
      municipioId: m.id,
      status: mapa.has(m.id) ? classificar(mapa.get(m.id)!) : 'NAO_RESPONDEU',
    }));
  }

  /** Estatísticas agregadas: contadores por status. */
  async buscarEstatisticas(competenciaId: string): Promise<{
    total: number;
    respondido: number;
    emPreenchimento: number;
    naoRespondeu: number;
    percentual: number;
  }> {
    const statuses = await this.buscarStatusMunicipios(competenciaId);
    const total = statuses.length;
    const respondido = statuses.filter((s) => s.status === 'RESPONDIDO').length;
    const emPreenchimento = statuses.filter((s) => s.status === 'EM_PREENCHIMENTO').length;
    const naoRespondeu = total - respondido - emPreenchimento;
    return {
      total,
      respondido,
      emPreenchimento,
      naoRespondeu,
      percentual: total > 0 ? Math.round((respondido / total) * 100) : 0,
    };
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
