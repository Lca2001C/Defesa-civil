import { BadRequestException } from '@nestjs/common';
import { SubmissaoStatus } from '@prisma/client';
import {
  AcaoCondicional,
  OperadorCondicional,
  TipoPergunta,
  type SchemaFormulario,
} from '@dcmg/contracts';
import { SubmissoesService } from './submissoes.service';
import type { SubmissoesRepository } from '../repositories/submissoes.repository';
import type { FormulariosService } from '../../formularios/services/formularios.service';
import type { JwtPayload } from '../../../common/types/jwt-payload';

/**
 * Testa a BARREIRA DE SEGURANCA do envio: as respostas sao validadas contra o
 * schema NO SERVIDOR (o backend nao confia no cliente). Segue o padrao dos
 * demais specs: unit puro com dependencias mockadas manualmente.
 */

function jwt(parcial: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: 'autor-1',
    email: 'a@a.com',
    perfilCodigo: 'ADMIN_MUNICIPAL',
    perfilNivel: 50,
    escopo: 'MUNICIPAL',
    ufId: 31,
    regionalId: null,
    municipioId: 3106200,
    permissoes: [],
    ...parcial,
  };
}

/** Schema com campo obrigatorio + condicional + grupo + municipio. */
function schemaTeste(): SchemaFormulario {
  return {
    versao: 1,
    paginas: [
      {
        titulo: 'Pagina 1',
        secoes: [
          {
            titulo: 'Secao 1',
            perguntas: [
              { codigo: 'nome', rotulo: 'Nome', tipo: TipoPergunta.TEXTO_CURTO, obrigatorio: true },
              { codigo: 'tem_portaria', rotulo: 'Tem portaria?', tipo: TipoPergunta.SIM_NAO, obrigatorio: true },
              {
                codigo: 'ano_portaria',
                rotulo: 'Ano da portaria',
                tipo: TipoPergunta.ANO,
                obrigatorio: true,
                regras: [
                  {
                    origemCodigo: 'tem_portaria',
                    operador: OperadorCondicional.IGUAL,
                    valor: 'true',
                    acao: AcaoCondicional.MOSTRAR,
                  },
                ],
              },
              { codigo: 'qtd_cursos', rotulo: 'Qtd cursos', tipo: TipoPergunta.NUMERO, obrigatorio: false },
              {
                codigo: 'cursos',
                rotulo: 'Cursos',
                tipo: TipoPergunta.GRUPO,
                obrigatorio: false,
                quantidadeOrigemCodigo: 'qtd_cursos',
                perguntas: [
                  { codigo: 'nome_curso', rotulo: 'Curso', tipo: TipoPergunta.TEXTO_CURTO, obrigatorio: true },
                ],
              },
              { codigo: 'mun_sede', rotulo: 'Municipio', tipo: TipoPergunta.MUNICIPIO, obrigatorio: false },
            ],
          },
        ],
      },
    ],
  };
}

describe('SubmissoesService — validação server-side no envio', () => {
  let repo: jest.Mocked<SubmissoesRepository>;
  let formularios: jest.Mocked<FormulariosService>;
  let service: SubmissoesService;

  const submissaoBase = {
    id: 'sub-1',
    status: SubmissaoStatus.EM_PREENCHIMENTO,
    municipioId: 3106200,
    autorId: 'autor-1',
    formularioVersaoId: 'versao-1',
    competenciaId: 'comp-1',
    protocolo: 'RASCUNHO-x',
    emailRespondente: null,
    nomeRespondente: 'Autor',
  };

  beforeEach(() => {
    repo = {
      buscarPorId: jest.fn().mockResolvedValue(submissaoBase),
      gerarProtocolo: jest.fn().mockResolvedValue('MG-2026-00000001'),
      contextoAutomatico: jest.fn().mockResolvedValue({
        municipioId: 3106200,
        municipioNome: 'Belo Horizonte',
        autorNome: 'Autor',
        competenciaNome: 'Competencia 2026',
      }),
      perguntasAutomaticas: jest.fn().mockResolvedValue([]),
      lerRespostas: jest.fn().mockResolvedValue({}),
      buscarMunicipioNome: jest.fn().mockResolvedValue('Belo Horizonte'),
      enviarComHistorico: jest.fn().mockResolvedValue({ ...submissaoBase, status: SubmissaoStatus.ENVIADO }),
      buscarRegionalDoMunicipio: jest.fn(),
    } as unknown as jest.Mocked<SubmissoesRepository>;

    formularios = {
      comporSchema: jest.fn().mockResolvedValue(schemaTeste()),
    } as unknown as jest.Mocked<FormulariosService>;

    const cache = { cacheDelPorPrefixo: jest.fn() };
    const notificacoes = { notificar: jest.fn() };

    service = new SubmissoesService(
      repo,
      notificacoes as never,
      formularios,
      {} as never, // storage — não usado no envio
      cache as never,
      {} as never, // export — não usado no envio
      { registrar: jest.fn() } as never, // auditoria
      { get: jest.fn().mockReturnValue(50) } as never, // config
    );
  });

  function respostasValidas(): Record<string, unknown> {
    return { nome: 'COMPDEC BH', tem_portaria: false, qtd_cursos: 0, cursos: [] };
  }

  it('envia quando as respostas satisfazem o schema', async () => {
    repo.lerRespostas.mockResolvedValue(respostasValidas());
    const resultado = await service.enviar('sub-1', jwt());
    expect(resultado.status).toBe(SubmissaoStatus.ENVIADO);
    expect(repo.enviarComHistorico).toHaveBeenCalled();
  });

  it('bloqueia envio com obrigatória visível ausente (400 com lista de erros)', async () => {
    repo.lerRespostas.mockResolvedValue({ tem_portaria: false, qtd_cursos: 0, cursos: [] });
    await expect(service.enviar('sub-1', jwt())).rejects.toMatchObject({
      constructor: BadRequestException,
      response: { erros: [{ codigo: 'nome', mensagem: 'Campo obrigatorio.' }] },
    });
    expect(repo.enviarComHistorico).not.toHaveBeenCalled();
  });

  it('exige campo condicional quando visível (Se Sim, abrir campo)', async () => {
    repo.lerRespostas.mockResolvedValue({ ...respostasValidas(), tem_portaria: true });
    await expect(service.enviar('sub-1', jwt())).rejects.toMatchObject({
      response: { erros: [{ codigo: 'ano_portaria' }] },
    });
  });

  it('bloqueia grupo com quantidade divergente da controladora', async () => {
    repo.lerRespostas.mockResolvedValue({ ...respostasValidas(), qtd_cursos: 2, cursos: [] });
    await expect(service.enviar('sub-1', jwt())).rejects.toMatchObject({
      response: { erros: [{ codigo: 'cursos' }] },
    });
  });

  it('bloqueia MUNICIPIO inexistente na base oficial', async () => {
    repo.lerRespostas.mockResolvedValue({
      ...respostasValidas(),
      mun_sede: { id: 9999999, nome: 'Cidade Fantasma' },
    });
    repo.buscarMunicipioNome.mockResolvedValue(null);
    await expect(service.enviar('sub-1', jwt())).rejects.toMatchObject({
      response: { erros: [{ codigo: 'mun_sede', mensagem: 'Município não encontrado na base oficial.' }] },
    });
  });

  it('criar com enviarImediatamente também valida contra o schema', async () => {
    const repoCriar = repo as unknown as {
      buscarAutor: jest.Mock;
      buscarVersao: jest.Mock;
      buscarCompetencia: jest.Mock;
      buscarMunicipioNome: jest.Mock;
      criarComRespostas: jest.Mock;
    };
    repoCriar.buscarAutor = jest.fn().mockResolvedValue({
      nome: 'Autor',
      cpf: '00000000000',
      cargo: null,
      email: 'a@a.com',
      telefone: null,
    });
    repoCriar.buscarVersao = jest.fn().mockResolvedValue({ status: 'PUBLICADO' });
    repoCriar.buscarCompetencia = jest.fn().mockResolvedValue({ status: 'ABERTA', nome: 'Comp 2026' });
    repoCriar.criarComRespostas = jest.fn();

    await expect(
      service.criar(
        {
          municipioId: 3106200,
          formularioVersaoId: 'versao-1',
          competenciaId: 'comp-1',
          dados: {}, // sem a obrigatória "nome"
          enviarImediatamente: true,
        } as never,
        jwt(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repoCriar.criarComRespostas).not.toHaveBeenCalled();
  });
});
