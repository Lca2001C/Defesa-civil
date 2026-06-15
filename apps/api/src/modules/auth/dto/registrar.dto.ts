import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class RegistrarDto {
  @ApiProperty({ example: 'Maria Silva' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  nome!: string;

  @ApiProperty({ example: '12345678901', description: '11 dígitos sem formatação' })
  @Matches(/^\d{11}$/, { message: 'CPF deve ter 11 dígitos numéricos.' })
  cpf!: string;

  @ApiProperty({ example: 'maria.silva@prefeitura.mg.gov.br' })
  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(200)
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
  @MaxLength(128)
  senha!: string;

  @ApiProperty({ description: 'Deve ser idêntica ao campo senha.' })
  @IsString()
  @ValidateIf((o: RegistrarDto) => o.confirmarSenha !== o.senha)
  confirmarSenha!: string;

  @ApiPropertyOptional({ description: 'Código IBGE do município (obrigatório para operador municipal).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  municipioId?: number;

  @ApiProperty()
  @IsString()
  @MaxLength(30)
  telefone!: string;

  @ApiProperty({ example: '1.0', description: 'Versão do Termo LGPD exibido ao usuário.' })
  @IsNotEmpty()
  @IsString()
  versaoTermoAceito!: string;

  @ApiProperty({ description: 'Deve ser true — usuário confirmou leitura dos termos.' })
  @IsBoolean()
  aceiteTermoLgpd!: boolean;

  @ApiProperty({ description: 'Informa se o usuário é o Coordenador da COMPDEC do seu município.' })
  @IsBoolean()
  ehCoordenadorCompdec!: boolean;
}
