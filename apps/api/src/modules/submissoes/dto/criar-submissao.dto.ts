import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CriarSubmissaoDto {
  @IsString()
  @IsNotEmpty()
  formularioVersaoId!: string;

  @IsString()
  @IsNotEmpty()
  competenciaId!: string;

  @IsInt()
  @Type(() => Number)
  municipioId!: number;

  @IsObject()
  dados!: Record<string, unknown>;

  /** Se true a submissão já entra com status ENVIADA e recebe protocolo. */
  @IsOptional()
  @IsBoolean()
  enviarImediatamente?: boolean;

  // Snapshot do respondente — opcional: se omitidos, vêm do cadastro do usuário.
  @IsOptional()
  @IsString()
  nomeRespondente?: string;

  @IsOptional()
  @IsString()
  cpfRespondente?: string;

  @IsOptional()
  @IsString()
  cargoRespondente?: string;

  @IsOptional()
  @IsString()
  emailRespondente?: string;

  @IsOptional()
  @IsString()
  telefoneRespondente?: string;
}
