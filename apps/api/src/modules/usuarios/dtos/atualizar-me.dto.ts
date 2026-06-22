import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AtualizarMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cargo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefone?: string;
}
