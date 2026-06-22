import { Injectable } from '@nestjs/common';
import type { SubmissaoStatus } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type { JwtPayload } from '../../../common/types/jwt-payload';
import {
  montarWhereSubmissoes,
  type FiltrosSubmissao,
} from '../../submissoes/utils/submissoes-where.util';

/** Linha de submissão usada na geração do Excel. */
export interface LinhaExport {
  id: string;
  protocolo: string | null;
  municipioId: number;
  status: SubmissaoStatus;
  nomeRespondente: string;
  cpfRespondente: string;
  cargoRespondente: string | null;
  emailRespondente: string | null;
  enviadoEm: Date | null;
  aprovadoEm: Date | null;
  municipioNome: string;
  regionalNome: string | null;
  competenciaNome: string;
  formularioNome: string;
  versao: number;
}

/** Acesso a dados da exportação de submissões (única camada que toca o Prisma). */
@Injectable()
export class RelatoriosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async competenciaExiste(id: string): Promise<boolean> {
    return !!(await this.prisma.competencia.findUnique({ where: { id }, select: { id: true } }));
  }

  async competenciaNome(id: string): Promise<string | null> {
    const c = await this.prisma.competencia.findUnique({ where: { id }, select: { nome: true } });
    return c?.nome ?? null;
  }

  contar(filtros: FiltrosSubmissao, usuario: JwtPayload): Promise<number> {
    return this.prisma.submissao.count({ where: montarWhereSubmissoes(filtros, usuario) });
  }

  async lerLote(
    filtros: FiltrosSubmissao,
    usuario: JwtPayload,
    take: number,
    cursor?: string,
  ): Promise<LinhaExport[]> {
    const lote = await this.prisma.submissao.findMany({
      where: montarWhereSubmissoes(filtros, usuario),
      select: {
        id: true,
        protocolo: true,
        municipioId: true,
        status: true,
        nomeRespondente: true,
        cpfRespondente: true,
        cargoRespondente: true,
        emailRespondente: true,
        enviadoEm: true,
        aprovadoEm: true,
        municipio: { select: { nome: true, regional: { select: { nome: true } } } },
        competencia: { select: { nome: true } },
        formularioVersao: { select: { versao: true, formulario: { select: { nome: true } } } },
      },
      orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    return lote.map((s) => ({
      id: s.id,
      protocolo: s.protocolo,
      municipioId: s.municipioId,
      status: s.status,
      nomeRespondente: s.nomeRespondente,
      cpfRespondente: s.cpfRespondente,
      cargoRespondente: s.cargoRespondente,
      emailRespondente: s.emailRespondente,
      enviadoEm: s.enviadoEm,
      aprovadoEm: s.aprovadoEm,
      municipioNome: s.municipio.nome,
      regionalNome: s.municipio.regional?.nome ?? null,
      competenciaNome: s.competencia.nome,
      formularioNome: s.formularioVersao.formulario.nome,
      versao: s.formularioVersao.versao,
    }));
  }

  async agruparPorStatus(
    filtros: FiltrosSubmissao,
    usuario: JwtPayload,
  ): Promise<{ status: SubmissaoStatus; total: number }[]> {
    const grupos = await this.prisma.submissao.groupBy({
      by: ['status'],
      where: montarWhereSubmissoes(filtros, usuario),
      _count: { _all: true },
    });
    return grupos.map((g) => ({ status: g.status, total: g._count._all }));
  }
}
