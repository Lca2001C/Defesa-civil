import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FormulariosService } from './formularios.service';
import type { FormulariosRepository } from '../repositories/formularios.repository';

describe('FormulariosService', () => {
  let repo: jest.Mocked<FormulariosRepository>;
  let service: FormulariosService;

  beforeEach(() => {
    repo = {
      existe: jest.fn(),
      contarSubmissoesDoFormulario: jest.fn(),
      removerComVersoes: jest.fn(),
      buscarPorId: jest.fn(),
    } as unknown as jest.Mocked<FormulariosRepository>;
    service = new FormulariosService(repo);
  });

  it('excluir lança NotFound quando o formulário não existe', async () => {
    repo.existe.mockResolvedValue(false);
    await expect(service.excluir('1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('excluir bloqueia quando há submissões vinculadas', async () => {
    repo.existe.mockResolvedValue(true);
    repo.contarSubmissoesDoFormulario.mockResolvedValue(3);
    await expect(service.excluir('1')).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.removerComVersoes).not.toHaveBeenCalled();
  });

  it('excluir remove quando não há submissões', async () => {
    repo.existe.mockResolvedValue(true);
    repo.contarSubmissoesDoFormulario.mockResolvedValue(0);
    repo.removerComVersoes.mockResolvedValue(undefined);
    await service.excluir('1');
    expect(repo.removerComVersoes).toHaveBeenCalledWith('1');
  });
});
