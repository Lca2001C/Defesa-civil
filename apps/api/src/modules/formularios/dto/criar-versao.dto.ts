import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

/**
 * Schema do formulario (SchemaFormulario de @dcmg/contracts).
 * Validacao de estrutura interna e feita no servico; aqui garantimos apenas
 * que o campo e um objeto JSON valido.
 */
export class CriarVersaoDto {
  @ApiProperty({
    description: 'Schema declarativo do formulário (SchemaFormulario).',
    example: {
      versao: 1,
      titulo: 'Plano Municipal',
      secoes: [
        {
          chave: 'identificacao',
          titulo: 'Identificação',
          campos: [
            {
              chave: 'nomeMunicipio',
              rotulo: 'Nome do Município',
              tipo: 'TEXTO',
              obrigatorio: true,
            },
          ],
        },
      ],
    },
  })
  @IsObject()
  schema!: Record<string, unknown>;
}
