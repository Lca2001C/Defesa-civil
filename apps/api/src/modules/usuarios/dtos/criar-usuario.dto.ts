import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EscopoUsuario } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CriarUsuarioDto {
  @ApiProperty({ example: 'Maria Souza' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nome!: string;

  @ApiProperty({ example: '12345678901', description: 'CPF sem formatação' })
  @IsString()
  @Matches(/^\d{11}$/, { message: 'CPF deve conter 11 dígitos numéricos.' })
  cpf!: string;

  @ApiProperty({ example: 'maria.souza@prefeitura.mg.gov.br' })
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @ApiProperty({ example: 'Defesa@Civil2026!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  senha!: string;

  @ApiPropertyOptional({ example: 'Coordenadora de Defesa Civil' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cargo?: string;

  @ApiPropertyOptional({ example: '(31) 99999-0000' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefone?: string;

  @ApiProperty({ example: 'ADMIN_MUNICIPAL', description: 'Código do perfil RBAC' })
  @IsString()
  @IsNotEmpty()
  perfilCodigo!: string;

  @ApiProperty({ enum: EscopoUsuario, example: EscopoUsuario.MUNICIPAL })
  @IsEnum(EscopoUsuario)
  escopo!: EscopoUsuario;

  @ApiPropertyOptional({ example: 31, description: 'ID IBGE da UF (quando ESTADUAL)' })
  @IsOptional()
  @IsInt()
  ufId?: number;

  @ApiPropertyOptional({ description: 'ID da Regional/REDEC (quando REGIONAL)' })
  @IsOptional()
  @IsString()
  regionalId?: string;

  @ApiPropertyOptional({ example: 3106200, description: 'Código IBGE do município (quando MUNICIPAL)' })
  @IsOptional()
  @IsInt()
  municipioId?: number;
}
