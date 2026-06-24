import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

// Upload de anexo em duas etapas (Azure Blob via SAS, PUT único):
//  1) iniciar  → backend valida e devolve a URL SAS de escrita + chave;
//  2) completar → após o PUT direto no Blob, registra o anexo no banco.

export class IniciarAnexoDto {
  @IsString()
  @MaxLength(255)
  nomeOriginal!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  mimeType?: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  tamanhoBytes!: number;

  @IsOptional()
  @IsString()
  perguntaCodigo?: string;
}

export class CompletarAnexoDto {
  @IsString()
  chave!: string;

  @IsString()
  @MaxLength(255)
  nomeOriginal!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  mimeType?: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  tamanhoBytes!: number;

  @IsOptional()
  @IsString()
  perguntaCodigo?: string;
}
