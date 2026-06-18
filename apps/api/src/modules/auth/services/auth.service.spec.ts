import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { AuthRepository } from '../repositories/auth.repository';

describe('AuthService', () => {
  let repo: jest.Mocked<AuthRepository>;
  let redis: { getClient: jest.Mock };
  let rc: { get: jest.Mock; pipeline: jest.Mock; del: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    rc = {
      get: jest.fn(),
      del: jest.fn(),
      pipeline: jest.fn().mockReturnValue({ incr: jest.fn(), expire: jest.fn(), exec: jest.fn() }),
    };
    redis = { getClient: jest.fn().mockReturnValue(rc) };
    repo = {
      buscarPorEmailComPerfil: jest.fn(),
      buscarTermoAtivo: jest.fn(),
    } as unknown as jest.Mocked<AuthRepository>;
    service = new AuthService(repo, redis as never, {} as never, {} as never);
  });

  it('buscarTermoAtual lança NotFound quando não há termo ativo', async () => {
    repo.buscarTermoAtivo.mockResolvedValue(null);
    await expect(service.buscarTermoAtual()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('login bloqueia após exceder o número de tentativas', async () => {
    rc.get.mockResolvedValue('5');
    await expect(service.login('a@a.com', 'x')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('login rejeita credenciais inválidas (usuário inexistente)', async () => {
    rc.get.mockResolvedValue(null);
    repo.buscarPorEmailComPerfil.mockResolvedValue(null);
    await expect(service.login('a@a.com', 'x')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
