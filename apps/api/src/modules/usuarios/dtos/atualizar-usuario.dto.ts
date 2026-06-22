import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AtualizarUsuarioDto {
  @ApiPropertyOptional({ example: 'Maria Souza Santos' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nome?: string;

  @ApiPropertyOptional({ example: 'Coordenadora Municipal' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cargo?: string;

  @ApiPropertyOptional({ example: '(31) 98888-0000' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefone?: string;

  @ApiPropertyOptional({ example: 'OPERADOR_MUNICIPAL', description: 'Código do perfil RBAC' })
  @IsOptional()
  @IsString()
  perfilCodigo?: string;
}
