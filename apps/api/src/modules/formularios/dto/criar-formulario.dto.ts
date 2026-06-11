import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CriarFormularioDto {
  @ApiProperty({ example: 'Plano Municipal de Defesa Civil' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nome!: string;

  @ApiPropertyOptional({ example: 'Coleta das informações do plano anual do município.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descricao?: string;

  @ApiPropertyOptional({ example: 'Planejamento' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  categoria?: string;
}
