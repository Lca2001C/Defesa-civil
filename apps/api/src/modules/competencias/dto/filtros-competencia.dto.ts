import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { CompetenciaStatus } from '@prisma/client';
import { PaginacaoDto } from '../../../common/dto/paginacao.dto';

export class FiltrosCompetenciaDto extends PaginacaoDto {
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  ano?: number;

  @ApiPropertyOptional({ enum: CompetenciaStatus })
  @IsOptional()
  @IsEnum(CompetenciaStatus)
  status?: CompetenciaStatus;
}
