import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FormulariosService } from './formularios.service';
import type { FormulariosRepository } from '../repositories/formularios.repository';
import type { FormularioImportService } from './formulario-import.service';
import type { AuditoriaService } from '../../auditoria/services/auditoria.service';

describe('FormulariosService', () => {
  let repo: jest.Mocked<FormulariosRepository>;
  let importService: jest.Mocked<FormularioImportService>;
  let auditoria: jest.Mocked<AuditoriaService>;
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
      parsear: jest.fn(),
      gerarModelo: jest.fn(),
    } as unknown as jest.Mocked<FormularioImportService>;
    auditoria = { registrar: jest.fn() } as unknown as jest.Mocked<AuditoriaService>;
    service = new FormulariosService(repo, importService, auditoria);
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

  it('importarExcel cria o formulário e registra auditoria quando não há erros', async () => {
    importService.parsear.mockResolvedValue({
      nome: 'Caracterização COMPDEC',
      schema: { versao: 1, paginas: [], descricao: 'x' },
      resumo: { secoes: 2, perguntas: 10, listas: 1, regras: 1 },
      erros: [],
    });
    (repo.criarComSchema as jest.Mock).mockResolvedValue({ id: 'f1', versaoInicialId: 'v1' });

    const buffer = Buffer.from('fake-xlsx');
    const resultado = await service.importarExcel(buffer, { atorId: 'u1', nomeArquivo: 'plan.xlsx' });

    expect(importService.parsear).toHaveBeenCalledWith(buffer);
    expect(repo.criarComSchema).toHaveBeenCalledWith(
      { nome: 'Caracterização COMPDEC', descricao: 'x', categoria: 'Importado (Excel)' },
      expect.objectContaining({ versao: 1 }),
    );
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'IMPORTAR_FORMULARIO', entidadeId: 'f1', atorId: 'u1' }),
    );
    expect(resultado).toMatchObject({ id: 'f1', resumo: { perguntas: 10 } });
  });

  it('importarExcel bloqueia (400) quando o parse retorna erros', async () => {
    importService.parsear.mockResolvedValue({
      nome: 'X',
      schema: { versao: 1, paginas: [] },
      resumo: { secoes: 0, perguntas: 0, listas: 0, regras: 0 },
      erros: ['Aba "S": tipo inválido.'],
    });
    await expect(service.importarExcel(Buffer.from('x'))).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.criarComSchema).not.toHaveBeenCalled();
  });
});
