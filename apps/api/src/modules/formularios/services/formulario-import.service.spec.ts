import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { TipoPergunta } from '@dcmg/contracts';
import { FormularioImportService } from './formulario-import.service';

/**
 * Monta um .xlsx em memória (aba Perguntas + Instrucoes) para testar o parser
 * sem depender de arquivos externos.
 */
const CABECALHO = [
  'Pagina', 'Secao', 'Codigo', 'Pergunta', 'Tipo', 'Obrigatoria', 'Ajuda',
  'Opcoes', 'PermiteOutro', 'Multipla', 'CondicionalDe', 'CondicionalValor',
  'Grupo', 'QuantidadeDe', 'Min', 'Max',
];

async function montarXlsx(linhas: (string | number)[][], nome = 'Form Teste'): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const instr = wb.addWorksheet('Instrucoes');
  instr.getCell('A1').value = 'Nome do formulário:';
  instr.getCell('B1').value = nome;
  const ws = wb.addWorksheet('Perguntas');
  ws.addRow(CABECALHO);
  for (const l of linhas) ws.addRow(l);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// Helper para uma linha completa (16 colunas) a partir de um parcial por índice.
function linha(vals: Partial<Record<number, string | number>>): (string | number)[] {
  return Array.from({ length: 16 }, (_, i) => vals[i] ?? '');
}

describe('FormularioImportService — parsearSchema', () => {
  const service = new FormularioImportService();

  it('importa formulário com página, condicional, grupo e "Outro(s)"', async () => {
    const buffer = await montarXlsx([
      // cargo com PermiteOutro (col 8 = S)
      linha({ 0: 'P1', 1: 'Ident', 2: 'cargo', 3: 'Cargo', 4: 'LISTA_SUSPENSA', 5: 'S', 7: 'Coordenador;Diretor', 8: 'S' }),
      // Sim/Não que abre condicional
      linha({ 0: 'P1', 1: 'Ident', 2: 'tem_portaria', 3: 'Tem portaria?', 4: 'SIM_NAO', 5: 'S' }),
      linha({ 0: 'P1', 1: 'Ident', 2: 'ano_portaria', 3: 'Ano', 4: 'ANO', 5: 'S', 10: 'tem_portaria', 11: 'true' }),
      // Grupo controlado por quantidade
      linha({ 0: 'P2', 1: 'Cursos', 2: 'qtd', 3: 'Qtos cursos?', 4: 'NUMERO', 5: 'S' }),
      linha({ 0: 'P2', 1: 'Cursos', 2: 'cursos', 3: 'Cursos', 4: 'GRUPO', 13: 'qtd' }),
      linha({ 0: 'P2', 1: 'Cursos', 2: 'curso_nome', 3: 'Nome', 4: 'TEXTO_CURTO', 5: 'S', 12: 'cursos' }),
    ]);

    const { nome, schema } = await service.parsearSchema(buffer);
    expect(nome).toBe('Form Teste');
    expect(schema.paginas).toHaveLength(2);

    const p1 = schema.paginas[0]!;
    const perguntasP1 = p1.secoes[0]!.perguntas;
    // cargo + companheira "cargo_outro" + tem_portaria + ano_portaria
    const codigos = perguntasP1.map((p) => p.codigo);
    expect(codigos).toContain('cargo');
    expect(codigos).toContain('cargo_outro');
    const cargo = perguntasP1.find((p) => p.codigo === 'cargo')!;
    expect(cargo.opcoes?.some((o) => o.valor === 'outro')).toBe(true);
    const companheira = perguntasP1.find((p) => p.codigo === 'cargo_outro')!;
    expect(companheira.obrigatorio).toBe(true);
    expect(companheira.regras?.[0]).toMatchObject({ origemCodigo: 'cargo', valor: 'outro' });

    // Grupo com subpergunta e quantidade
    const grupo = schema.paginas[1]!.secoes[0]!.perguntas.find((p) => p.codigo === 'cursos')!;
    expect(grupo.tipo).toBe(TipoPergunta.GRUPO);
    expect(grupo.quantidadeOrigemCodigo).toBe('qtd');
    expect(grupo.perguntas?.map((s) => s.codigo)).toEqual(['curso_nome']);
  });

  it('rejeita tipo inválido com número da linha', async () => {
    const buffer = await montarXlsx([
      linha({ 0: 'P1', 1: 'S', 2: 'x', 3: 'Campo', 4: 'TIPO_ERRADO', 5: 'N' }),
    ]);
    await expect(service.parsearSchema(buffer)).rejects.toMatchObject({
      constructor: BadRequestException,
      response: { erros: [{ linha: 2, mensagem: expect.stringContaining('Tipo inválido') }] },
    });
  });

  it('rejeita código duplicado apontando a linha', async () => {
    const buffer = await montarXlsx([
      linha({ 0: 'P1', 1: 'S', 2: 'dup', 3: 'A', 4: 'TEXTO_CURTO' }),
      linha({ 0: 'P1', 1: 'S', 2: 'dup', 3: 'B', 4: 'TEXTO_CURTO' }),
    ]);
    await expect(service.parsearSchema(buffer)).rejects.toMatchObject({
      response: { erros: [{ linha: 3, mensagem: expect.stringContaining('duplicado') }] },
    });
  });

  it('rejeita Grupo referenciando código inexistente', async () => {
    const buffer = await montarXlsx([
      linha({ 0: 'P1', 1: 'S', 2: 'sub', 3: 'Sub', 4: 'TEXTO_CURTO', 12: 'grupo_fantasma' }),
    ]);
    await expect(service.parsearSchema(buffer)).rejects.toMatchObject({
      response: { erros: [{ linha: 2, mensagem: expect.stringContaining('não existe') }] },
    });
  });

  it('rejeita QuantidadeDe que não é NUMERO', async () => {
    const buffer = await montarXlsx([
      linha({ 0: 'P1', 1: 'S', 2: 'txt', 3: 'Texto', 4: 'TEXTO_CURTO' }),
      linha({ 0: 'P1', 1: 'S', 2: 'g', 3: 'Grupo', 4: 'GRUPO', 13: 'txt' }),
      linha({ 0: 'P1', 1: 'S', 2: 'gsub', 3: 'Sub', 4: 'TEXTO_CURTO', 12: 'g' }),
    ]);
    await expect(service.parsearSchema(buffer)).rejects.toMatchObject({
      response: { erros: expect.arrayContaining([expect.objectContaining({ linha: 3 })]) },
    });
  });
});

describe('FormularioImportService — gerarModelo', () => {
  const service = new FormularioImportService();

  it('gera um .xlsx válido cujo próprio modelo é reimportável', async () => {
    const modelo = await service.gerarModelo();
    expect(modelo.length).toBeGreaterThan(0);
    // O modelo (com exemplos) deve ser um formulário válido ao reimportar.
    const { schema } = await service.parsearSchema(modelo);
    expect(schema.paginas.length).toBeGreaterThan(0);
  });
});
