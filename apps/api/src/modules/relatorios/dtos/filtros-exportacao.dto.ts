import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { SubmissaoStatus } from '@prisma/client';

/** Filtros da exportação de submissões (mesma semântica da listagem). */
export class FiltrosExportacaoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  competenciaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  formularioVersaoId?: string;

  @ApiPropertyOptional({ enum: SubmissaoStatus })
  @IsOptional()
  @IsEnum(SubmissaoStatus)
  status?: SubmissaoStatus;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  municipioId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  regionalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  busca?: string;

  @ApiPropertyOptional({ description: 'Data inicial (ISO 8601).' })
  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @ApiPropertyOptional({ description: 'Data final (ISO 8601).' })
  @IsOptional()
  @IsDateString()
  dataFim?: string;
}
