import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CompetenciaStatus } from '@prisma/client';
import { CompetenciasService } from './competencias.service';
import type { CompetenciasRepository } from '../repositories/competencias.repository';

describe('CompetenciasService', () => {
  let repo: jest.Mocked<CompetenciasRepository>;
  let service: CompetenciasService;

  beforeEach(() => {
    repo = {
      criar: jest.fn(),
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      atualizar: jest.fn(),
      atualizarStatus: jest.fn(),
    } as unknown as jest.Mocked<CompetenciasRepository>;
    service = new CompetenciasService(repo);
  });

  it('buscarPorId lança NotFound quando ausente', async () => {
    repo.buscarPorId.mockResolvedValue(null);
    await expect(service.buscarPorId('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('abrir rejeita competência que não está PLANEJADA', async () => {
    repo.buscarPorId.mockResolvedValue({ id: '1', status: CompetenciaStatus.ABERTA } as never);
    await expect(service.abrir('1')).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.atualizarStatus).not.toHaveBeenCalled();
  });

  it('abrir transiciona PLANEJADA → ABERTA', async () => {
    repo.buscarPorId.mockResolvedValue({ id: '1', status: CompetenciaStatus.PLANEJADA } as never);
    repo.atualizarStatus.mockResolvedValue({ id: '1', status: CompetenciaStatus.ABERTA } as never);
    await service.abrir('1');
    expect(repo.atualizarStatus).toHaveBeenCalledWith('1', CompetenciaStatus.ABERTA);
  });

  it('encerrar rejeita competência que não está ABERTA', async () => {
    repo.buscarPorId.mockResolvedValue({ id: '1', status: CompetenciaStatus.PLANEJADA } as never);
    await expect(service.encerrar('1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
