import { IsOptional, IsString } from 'class-validator';

export class RevisaoDto {
  @IsOptional()
  @IsString()
  comentario?: string;
}
