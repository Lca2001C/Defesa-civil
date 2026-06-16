import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class IniciarMultipartDto {
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

export class AssinarParteDto {
  @IsString()
  chave!: string;

  @IsString()
  uploadId!: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  numeroParte!: number;
}

export class ParteConcluidaDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  numero!: number;

  @IsString()
  etag!: string;
}

export class CompletarMultipartDto {
  @IsString()
  chave!: string;

  @IsString()
  uploadId!: string;

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParteConcluidaDto)
  partes!: ParteConcluidaDto[];
}

export class AbortarMultipartDto {
  @IsString()
  chave!: string;

  @IsString()
  uploadId!: string;
}
