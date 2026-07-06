import { ForbiddenException } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import type { UsuariosRepository } from '../repositories/usuarios.repository';
import type { JwtPayload } from '../../../common/types/jwt-payload';

function jwt(parcial: Partial<JwtPayload>): JwtPayload {
  return {
    sub: 'eu',
    email: 'e@e.com',
    perfilCodigo: 'OPERADOR_MUNICIPAL',
    perfilNivel: 20,
    escopo: 'MUNICIPAL',
    ufId: 31,
    regionalId: null,
    municipioId: 1,
    permissoes: [],
    ...parcial,
  };
}

describe('UsuariosService (regras de escopo/permissão)', () => {
  let repo: jest.Mocked<UsuariosRepository>;
  let service: UsuariosService;

  beforeEach(() => {
    repo = {
      buscarDetalhado: jest.fn(),
      buscarPorId: jest.fn(),
      atualizar: jest.fn(),
      invalidarSessoes: jest.fn(),
    } as unknown as jest.Mocked<UsuariosRepository>;
    service = new UsuariosService(repo);
  });

  it('buscarPorId nega acesso a outro usuário quando nível insuficiente', async () => {
    await expect(service.buscarPorId('alvo', jwt({ sub: 'eu', perfilNivel: 20 }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repo.buscarDetalhado).not.toHaveBeenCalled();
  });

  it('redefinirSenha nega quando não é o próprio nem SUPER_ADMIN', async () => {
    await expect(
      service.redefinirSenha('alvo', 'NovaSenha@2026', jwt({ sub: 'eu', perfilNivel: 50 })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('atualizar nega alteração de perfil para usuário que não é SUPER_ADMIN', async () => {
    await expect(
      service.atualizar(
        'alvo',
        { perfilCodigo: 'GESTOR_ESTADUAL' },
        jwt({ sub: 'eu', perfilNivel: 80 }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.atualizar).not.toHaveBeenCalled();
  });
});
