import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

/**
 * Schema declarativo do formulario (SchemaFormulario de @dcmg/contracts).
 * A validacao estrutural e a decomposicao em linhas (Secao/Pergunta/Opcao/Regra)
 * sao feitas no servico; aqui garantimos apenas que e um objeto JSON.
 */
export class CriarVersaoDto {
  @ApiProperty({
    description: 'Schema declarativo do formulário (SchemaFormulario).',
    example: {
      versao: 1,
      titulo: 'Diagnóstico COMPDEC',
      secoes: [
        {
          titulo: 'Identificação do Município',
          perguntas: [
            { codigo: 'codigo_ibge', rotulo: 'Código IBGE', tipo: 'AUTOMATICO', obrigatorio: true, fonteAutomatica: 'CODIGO_IBGE' },
            { codigo: 'nome_municipio', rotulo: 'Nome do Município', tipo: 'TEXTO_CURTO', obrigatorio: true },
          ],
        },
      ],
    },
  })
  @IsObject()
  schema!: Record<string, unknown>;
}
