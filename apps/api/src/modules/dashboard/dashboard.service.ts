import { Injectable } from '@nestjs/common';
import { SubmissaoStatus } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { JwtPayload } from '../../common/types/jwt-payload';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ── filtro de escopo multi-tenant aplicado a todas as queries ──────────────

  private escopoWhere(usuario: JwtPayload): object {
    if (usuario.escopo === 'MUNICIPAL' && usuario.municipioId) {
      return { municipioId: usuario.municipioId };
    }
    if (usuario.escopo === 'REGIONAL' && usuario.regionalId) {
      return { municipio: { regionalId: usuario.regionalId } };
    }
    return {};
  }

  // ── resumo ─────────────────────────────────────────────────────────────────

  async buscarResumo(competenciaId: string, usuario: JwtPayload) {
    const escopo = this.escopoWhere(usuario);

    const [porStatus, totalMunicipios] = await Promise.all([
      this.prisma.submissao.groupBy({
        by: ['status'],
        where: { competenciaId, ...escopo },
        _count: { id: true },
      }),
      // total de municípios no escopo do usuário para calcular cobertura
      this.prisma.municipio.count({
        where:
          usuario.escopo === 'MUNICIPAL' && usuario.municipioId
            ? { id: usuario.municipioId }
            : usuario.escopo === 'REGIONAL' && usuario.regionalId
            ? { regionalId: usuario.regionalId }
            : { ufId: 31 }, // MG
      }),
    ]);

    const c = Object.fromEntries(
      porStatus.map((r) => [r.status, r._count.id]),
    ) as Record<string, number>;

    const respondidas =
      (c[SubmissaoStatus.ENVIADA] ?? 0) +
      (c[SubmissaoStatus.EM_ANALISE] ?? 0) +
      (c[SubmissaoStatus.CORRECAO_SOLICITADA] ?? 0) +
      (c[SubmissaoStatus.REVISADA] ?? 0) +
      (c[SubmissaoStatus.VALIDADA] ?? 0);

    const total = Object.values(c).reduce((a, b) => a + b, 0);

    return {
      total,
      rascunho: c[SubmissaoStatus.RASCUNHO] ?? 0,
      enviada: c[SubmissaoStatus.ENVIADA] ?? 0,
      emAnalise: c[SubmissaoStatus.EM_ANALISE] ?? 0,
      correcaoSolicitada: c[SubmissaoStatus.CORRECAO_SOLICITADA] ?? 0,
      revisada: c[SubmissaoStatus.REVISADA] ?? 0,
      validada: c[SubmissaoStatus.VALIDADA] ?? 0,
      rejeitada: c[SubmissaoStatus.REJEITADA] ?? 0,
      respondidas,
      percentualCobertura:
        totalMunicipios > 0
          ? Math.min(100, Math.round((respondidas / totalMunicipios) * 1000) / 10)
          : 0,
    };
  }

  // ── timeline ───────────────────────────────────────────────────────────────

  async buscarTimeline(competenciaId: string, dias: number, usuario: JwtPayload) {
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);
    const escopo = this.escopoWhere(usuario);

    const submissoes = await this.prisma.submissao.findMany({
      where: {
        competenciaId,
        criadoEm: { gte: desde },
        status: { not: SubmissaoStatus.RASCUNHO },
        ...escopo,
      },
      select: { criadoEm: true, status: true },
      orderBy: { criadoEm: 'asc' },
    });

    const mapa = new Map<string, { enviadas: number; validadas: number }>();
    for (const s of submissoes) {
      const data = s.criadoEm.toISOString().slice(0, 10);
      const atual = mapa.get(data) ?? { enviadas: 0, validadas: 0 };
      atual.enviadas++;
      if (s.status === SubmissaoStatus.VALIDADA) atual.validadas++;
      mapa.set(data, atual);
    }

    return Array.from(mapa.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, v]) => ({ data, ...v }));
  }

  // ── por regional ───────────────────────────────────────────────────────────

  async buscarPorRegional(competenciaId: string, usuario: JwtPayload) {
    const escopo = this.escopoWhere(usuario);

    const submissoes = await this.prisma.submissao.findMany({
      where: {
        competenciaId,
        status: { not: SubmissaoStatus.RASCUNHO },
        ...escopo,
      },
      select: {
        status: true,
        municipio: {
          select: { regional: { select: { id: true, nome: true } } },
        },
      },
    });

    const mapa = new Map<
      string,
      { nome: string; total: number; validadas: number }
    >();
    for (const s of submissoes) {
      const id = s.municipio.regional?.id ?? '__sem_regional__';
      const nome = s.municipio.regional?.nome ?? 'Sem regional';
      const atual = mapa.get(id) ?? { nome, total: 0, validadas: 0 };
      atual.total++;
      if (s.status === SubmissaoStatus.VALIDADA) atual.validadas++;
      mapa.set(id, atual);
    }

    return Array.from(mapa.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.total - a.total);
  }

  // ── por formulário ─────────────────────────────────────────────────────────

  async buscarPorFormulario(competenciaId: string, usuario: JwtPayload) {
    const escopo = this.escopoWhere(usuario);

    const submissoes = await this.prisma.submissao.findMany({
      where: {
        competenciaId,
        status: { not: SubmissaoStatus.RASCUNHO },
        ...escopo,
      },
      select: {
        status: true,
        formularioVersao: {
          select: {
            id: true,
            versao: true,
            formulario: { select: { id: true, nome: true } },
          },
        },
      },
    });

    const mapa = new Map<
      string,
      { formularioId: string; nome: string; versao: number; total: number; validadas: number }
    >();
    for (const s of submissoes) {
      const fv = s.formularioVersao;
      const atual = mapa.get(fv.id) ?? {
        formularioId: fv.formulario.id,
        nome: fv.formulario.nome,
        versao: fv.versao,
        total: 0,
        validadas: 0,
      };
      atual.total++;
      if (s.status === SubmissaoStatus.VALIDADA) atual.validadas++;
      mapa.set(fv.id, atual);
    }

    return Array.from(mapa.entries())
      .map(([id, v]) => ({ formularioVersaoId: id, ...v }))
      .sort((a, b) => b.total - a.total);
  }
}
