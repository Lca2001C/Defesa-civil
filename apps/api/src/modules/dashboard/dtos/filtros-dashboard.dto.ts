import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class FiltrosDashboardDto {
  @ApiProperty({ description: 'ID da competência.' })
  @IsNotEmpty()
  @IsString()
  competenciaId!: string;
}

export class FiltrosTimelineDto extends FiltrosDashboardDto {
  @ApiPropertyOptional({ default: 30, minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  dias?: number = 30;
}
