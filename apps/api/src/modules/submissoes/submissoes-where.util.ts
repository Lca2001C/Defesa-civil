import { Prisma, SubmissaoStatus } from '@prisma/client';
import type { JwtPayload } from '../../common/types/jwt-payload';
import { PERMISSION_LEVEL } from '../../shared/constants';

/** Filtros aceitos tanto na listagem quanto na exportação de submissões. */
export interface FiltrosSubmissao {
  competenciaId?: string;
  formularioVersaoId?: string;
  municipioId?: number;
  regionalId?: string;
  status?: SubmissaoStatus;
  busca?: string;
  dataInicio?: string;
  dataFim?: string;
}

/** Para datas só-dia (YYYY-MM-DD), inclui até o fim do dia. */
function fimDoDia(valor: string): Date {
  const d = new Date(valor);
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Monta o `where` de submissões aplicando filtros + busca textual e, por cima,
 * as MESMAS regras de escopo/RBAC do usuário (MUNICIPAL → próprio município;
 * REGIONAL → sua regional; perfilNivel < 50 → apenas as próprias submissões).
 *
 * A busca NUNCA amplia o escopo: todas as condições de escopo são aplicadas como
 * `AND` por cima do filtro/busca informados. Compartilhado entre a listagem
 * (submissoes) e a exportação (relatorios) para garantir paridade lista ↔ export.
 */
export function montarWhereSubmissoes(
  filtros: FiltrosSubmissao,
  usuario: JwtPayload,
): Prisma.SubmissaoWhereInput {
  const where: Prisma.SubmissaoWhereInput = {};
  const and: Prisma.SubmissaoWhereInput[] = [];

  if (filtros.competenciaId) where.competenciaId = filtros.competenciaId;
  if (filtros.formularioVersaoId) where.formularioVersaoId = filtros.formularioVersaoId;
  if (filtros.status) where.status = filtros.status;
  if (filtros.municipioId) where.municipioId = filtros.municipioId;

  // Condições acumuladas sobre o município (filtro de regional + escopo regional).
  const municipioCond: Prisma.MunicipioWhereInput = {};
  if (filtros.regionalId) municipioCond.regionalId = filtros.regionalId;

  // Intervalo de datas sobre a criação (cobre rascunhos e enviados).
  if (filtros.dataInicio || filtros.dataFim) {
    where.criadoEm = {
      ...(filtros.dataInicio ? { gte: new Date(filtros.dataInicio) } : {}),
      ...(filtros.dataFim ? { lte: fimDoDia(filtros.dataFim) } : {}),
    };
  }

  // Busca textual (insensível a maiúsc./acentos via ILIKE no Postgres).
  const busca = filtros.busca?.trim();
  if (busca) {
    const orList: Prisma.SubmissaoWhereInput[] = [
      { protocolo: { contains: busca, mode: 'insensitive' } },
      { nomeRespondente: { contains: busca, mode: 'insensitive' } },
      { emailRespondente: { contains: busca, mode: 'insensitive' } },
      { municipio: { nome: { contains: busca, mode: 'insensitive' } } },
    ];
    // CPF: compara só os dígitos (o valor é gravado sem máscara).
    const digitos = busca.replace(/\D/g, '');
    if (digitos.length >= 3) orList.push({ cpfRespondente: { contains: digitos } });
    // Código IBGE exato (7 dígitos).
    if (/^\d{7}$/.test(busca)) orList.push({ municipioId: Number(busca) });
    and.push({ OR: orList });
  }

  // ── Escopo / RBAC (sempre por cima; nunca amplia) ──────────────────────────
  if (usuario.escopo === 'MUNICIPAL' && usuario.municipioId) {
    where.municipioId = usuario.municipioId;
  } else if (usuario.escopo === 'REGIONAL' && usuario.regionalId) {
    municipioCond.regionalId = usuario.regionalId;
  }

  if (Object.keys(municipioCond).length > 0) {
    where.municipio = municipioCond;
  }

  if (usuario.perfilNivel < PERMISSION_LEVEL.ADMIN_MUNICIPAL) {
    where.autorId = usuario.sub;
  }

  if (and.length > 0) where.AND = and;
  return where;
}
