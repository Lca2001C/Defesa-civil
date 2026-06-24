import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { AuthRepository } from '../repositories/auth.repository';

describe('AuthService', () => {
  let repo: jest.Mocked<AuthRepository>;
  let cache: {
    getNumero: jest.Mock;
    incr: jest.Mock;
    del: jest.Mock;
  };
  let auditoria: { registrar: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    cache = {
      getNumero: jest.fn().mockResolvedValue(0),
      incr: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(undefined),
    };
    repo = {
      buscarPorEmailComPerfil: jest.fn(),
      buscarTermoAtivo: jest.fn(),
      buscarParaRecuperacao: jest.fn(),
    } as unknown as jest.Mocked<AuthRepository>;
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new AuthService(repo, cache as never, {} as never, {} as never, auditoria as never);
  });

  it('buscarTermoAtual lança NotFound quando não há termo ativo', async () => {
    repo.buscarTermoAtivo.mockResolvedValue(null);
    await expect(service.buscarTermoAtual()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('login bloqueia após exceder o número de tentativas', async () => {
    cache.getNumero.mockResolvedValue(5);
    await expect(service.login('a@a.com', 'x')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('login rejeita credenciais inválidas (usuário inexistente)', async () => {
    cache.getNumero.mockResolvedValue(0);
    repo.buscarPorEmailComPerfil.mockResolvedValue(null);
    await expect(service.login('a@a.com', 'x')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recuperação de senha: respeita o rate limit por e-mail (não consulta o repo)', async () => {
    // incr retorna acima do limite (RESET_MAX=3) → retorna cedo, sem consultar.
    cache.incr.mockResolvedValue(4);
    await service.solicitarRecuperacaoSenha({ email: 'a@a.com' } as never, { ip: '1.2.3.4' });
    expect(repo.buscarParaRecuperacao).not.toHaveBeenCalled();
  });
});
