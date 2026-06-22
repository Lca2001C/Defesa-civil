import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class CriarCompetenciaDto {
  @ApiProperty({ example: 'Plano Municipal de Defesa Civil 2026 - 1º Trimestre' })
  @IsString()
  @IsNotEmpty()
  nome!: string;

  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2020)
  @Max(2099)
  ano!: number;

  @ApiProperty({ example: '2026-01-01', description: 'Data de inicio (ISO 8601).' })
  @IsDateString()
  dataInicio!: string;

  @ApiProperty({ example: '2026-03-31', description: 'Data de encerramento (ISO 8601).' })
  @IsDateString()
  dataFim!: string;
}
