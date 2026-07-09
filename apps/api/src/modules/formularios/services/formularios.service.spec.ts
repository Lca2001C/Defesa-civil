import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FormulariosService } from './formularios.service';
import type { FormulariosRepository } from '../repositories/formularios.repository';
import type { FormularioImportService } from './formulario-import.service';

describe('FormulariosService', () => {
  let repo: jest.Mocked<FormulariosRepository>;
  let importService: jest.Mocked<FormularioImportService>;
  let service: FormulariosService;

  beforeEach(() => {
    repo = {
      existe: jest.fn(),
      contarSubmissoesDoFormulario: jest.fn(),
      removerComVersoes: jest.fn(),
      buscarPorId: jest.fn(),
      criarComSchema: jest.fn(),
    } as unknown as jest.Mocked<FormulariosRepository>;
    importService = {
      parsearSchema: jest.fn(),
      gerarModelo: jest.fn(),
    } as unknown as jest.Mocked<FormularioImportService>;
    service = new FormulariosService(repo, importService);
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

  it('importarExcel cria o formulário a partir do schema parseado', async () => {
    importService.parsearSchema.mockResolvedValue({
      nome: 'Caracterização COMPDEC',
      schema: { versao: 1, paginas: [], descricao: 'x' },
    });
    (repo.criarComSchema as jest.Mock).mockResolvedValue({ id: 'f1', versaoInicialId: 'v1' });

    const buffer = Buffer.from('fake-xlsx');
    const resultado = await service.importarExcel(buffer);

    expect(importService.parsearSchema).toHaveBeenCalledWith(buffer);
    expect(repo.criarComSchema).toHaveBeenCalledWith(
      { nome: 'Caracterização COMPDEC', descricao: 'x', categoria: 'Importado' },
      expect.objectContaining({ versao: 1 }),
    );
    expect(resultado).toMatchObject({ id: 'f1' });
  });
});
