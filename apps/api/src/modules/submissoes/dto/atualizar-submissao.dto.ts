import { IsObject, IsOptional } from 'class-validator';

export class AtualizarSubmissaoDto {
  @IsOptional()
  @IsObject()
  dados?: Record<string, unknown>;
}
