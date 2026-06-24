import { Injectable } from '@nestjs/common';
import { SubmissaoStatus } from '@prisma/client';
import type { JwtPayload } from '../../../common/types/jwt-payload';
import { DashboardRepository, type EscopoDashboard } from '../repositories/dashboard.repository';

@Injectable()
export class DashboardService {
  constructor(private readonly repo: DashboardRepository) {}

  private escopoDe(usuario: JwtPayload): EscopoDashboard {
    return {
      escopo: usuario.escopo,
      municipioId: usuario.municipioId,
      regionalId: usuario.regionalId,
    };
  }

  // ── resumo ─────────────────────────────────────────────────────────────────

  async buscarResumo(competenciaId: string, usuario: JwtPayload) {
    const escopo = this.escopoDe(usuario);

    const [porStatus, totalMunicipios] = await Promise.all([
      this.repo.agruparPorStatus(competenciaId, escopo),
      this.repo.contarMunicipiosNoEscopo(escopo),
    ]);

    const c = Object.fromEntries(porStatus.map((r) => [r.status, r._count.id])) as Record<string, number>;

    const respondidas =
      (c[SubmissaoStatus.ENVIADO] ?? 0) +
      (c[SubmissaoStatus.CORRECAO_SOLICITADA] ?? 0) +
      (c[SubmissaoStatus.REVISADO] ?? 0) +
      (c[SubmissaoStatus.APROVADO] ?? 0);

    const total = Object.values(c).reduce((a, b) => a + b, 0);

    return {
      total,
      rascunho: c[SubmissaoStatus.RASCUNHO] ?? 0,
      emPreenchimento: c[SubmissaoStatus.EM_PREENCHIMENTO] ?? 0,
      enviada: c[SubmissaoStatus.ENVIADO] ?? 0,
      correcaoSolicitada: c[SubmissaoStatus.CORRECAO_SOLICITADA] ?? 0,
      revisada: c[SubmissaoStatus.REVISADO] ?? 0,
      aprovada: c[SubmissaoStatus.APROVADO] ?? 0,
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

    const submissoes = await this.repo.listarParaTimeline(competenciaId, desde, this.escopoDe(usuario));

    const mapa = new Map<string, { enviadas: number; aprovadas: number }>();
    for (const s of submissoes) {
      const data = s.criadoEm.toISOString().slice(0, 10);
      const atual = mapa.get(data) ?? { enviadas: 0, aprovadas: 0 };
      atual.enviadas++;
      if (s.status === SubmissaoStatus.APROVADO) atual.aprovadas++;
      mapa.set(data, atual);
    }

    return Array.from(mapa.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, v]) => ({ data, ...v }));
  }

  // ── por regional ───────────────────────────────────────────────────────────

  async buscarPorRegional(competenciaId: string, usuario: JwtPayload) {
    const { grupos, municipios } = await this.repo.agruparPorRegional(
      competenciaId,
      this.escopoDe(usuario),
    );
    const regionalDoMunicipio = new Map(municipios.map((m) => [m.id, m.regional]));

    const mapa = new Map<string, { nome: string; total: number; aprovadas: number }>();
    for (const g of grupos) {
      const regional = regionalDoMunicipio.get(g.municipioId);
      const id = regional?.id ?? '__sem_regional__';
      const nome = regional?.nome ?? 'Sem regional';
      const qtd = g._count._all;
      const atual = mapa.get(id) ?? { nome, total: 0, aprovadas: 0 };
      atual.total += qtd;
      if (g.status === SubmissaoStatus.APROVADO) atual.aprovadas += qtd;
      mapa.set(id, atual);
    }

    return Array.from(mapa.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.total - a.total);
  }

  // ── por formulário ─────────────────────────────────────────────────────────

  async buscarPorFormulario(competenciaId: string, usuario: JwtPayload) {
    const { grupos, versoes } = await this.repo.agruparPorFormulario(
      competenciaId,
      this.escopoDe(usuario),
    );
    const versaoPorId = new Map(versoes.map((v) => [v.id, v]));

    const mapa = new Map<
      string,
      { formularioId: string; nome: string; versao: number; total: number; aprovadas: number }
    >();
    for (const g of grupos) {
      const fv = versaoPorId.get(g.formularioVersaoId);
      if (!fv) continue;
      const qtd = g._count._all;
      const atual = mapa.get(fv.id) ?? {
        formularioId: fv.formulario.id,
        nome: fv.formulario.nome,
        versao: fv.versao,
        total: 0,
        aprovadas: 0,
      };
      atual.total += qtd;
      if (g.status === SubmissaoStatus.APROVADO) atual.aprovadas += qtd;
      mapa.set(fv.id, atual);
    }

    return Array.from(mapa.entries())
      .map(([id, v]) => ({ formularioVersaoId: id, ...v }))
      .sort((a, b) => b.total - a.total);
  }
}
