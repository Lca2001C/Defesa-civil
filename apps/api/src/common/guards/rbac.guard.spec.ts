import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RbacGuard } from './rbac.guard';
import { IS_PUBLIC_KEY } from '../decorators/publico.decorator';
import { PERMISSAO_KEY } from '../decorators/permissao.decorator';
import { NIVEL_MINIMO_KEY } from '../decorators/nivel-minimo.decorator';
import type { JwtPayload } from '../types/jwt-payload';

/**
 * Metadados por rota simulados. O Reflector é mockado para devolver o valor
 * correspondente à chave consultada (público / permissões / nível mínimo).
 */
interface Meta {
  publico?: boolean;
  permissoes?: string[];
  nivelMinimo?: number;
}

function criarGuard(meta: Meta): RbacGuard {
  const reflector = {
    getAllAndOverride: (chave: string) => {
      if (chave === IS_PUBLIC_KEY) return meta.publico;
      if (chave === PERMISSAO_KEY) return meta.permissoes;
      if (chave === NIVEL_MINIMO_KEY) return meta.nivelMinimo;
      return undefined;
    },
  } as unknown as Reflector;
  return new RbacGuard(reflector);
}

function contexto(user?: Partial<JwtPayload>): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RbacGuard — barreira por nível (@NivelMinimo)', () => {
  it('bloqueia quando o perfilNivel é inferior ao mínimo exigido', () => {
    const guard = criarGuard({ nivelMinimo: 80 });
    expect(() => guard.canActivate(contexto({ perfilNivel: 70, permissoes: [] }))).toThrow(
      ForbiddenException,
    );
  });

  it('permite quando o perfilNivel atende ao mínimo (Gestor Estadual)', () => {
    const guard = criarGuard({ nivelMinimo: 80 });
    expect(guard.canActivate(contexto({ perfilNivel: 80, permissoes: [] }))).toBe(true);
  });

  it('exige nível E permissão quando ambos são declarados', () => {
    const guard = criarGuard({ nivelMinimo: 80, permissoes: ['formularios.criar'] });
    // Nível ok, mas sem a permissão → bloqueia.
    expect(() =>
      guard.canActivate(contexto({ perfilNivel: 100, permissoes: [] })),
    ).toThrow(ForbiddenException);
    // Nível ok e permissão presente → passa.
    expect(
      guard.canActivate(contexto({ perfilNivel: 100, permissoes: ['formularios.criar'] })),
    ).toBe(true);
  });

  it('rota pública passa sem usuário nem checagens', () => {
    const guard = criarGuard({ publico: true, nivelMinimo: 80 });
    expect(guard.canActivate(contexto(undefined))).toBe(true);
  });

  it('rota sem @Permissao nem @NivelMinimo exige apenas autenticação', () => {
    const guard = criarGuard({});
    expect(guard.canActivate(contexto({ perfilNivel: 10, permissoes: [] }))).toBe(true);
  });
});
