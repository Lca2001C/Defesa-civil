import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class AtualizarCompdecDto {
  @ApiPropertyOptional({ example: 'João Silva' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  coordenadorNome?: string;

  @ApiPropertyOptional({ example: 'joao.silva@prefeitura.mg.gov.br' })
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ example: '(31) 99999-0000' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefone?: string;
}
