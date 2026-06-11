import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

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

  @ApiPropertyOptional({ description: 'Schema gerado pelo parser Excel. Se fornecido, cria a versão 1 (rascunho) automaticamente.' })
  @IsOptional()
  @IsObject()
  schema?: Record<string, unknown>;
}
