import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class SolicitarRecuperacaoDto {
  @ApiProperty({ example: 'operador@prefeitura.mg.gov.br' })
  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(200)
  email!: string;
}

export class RedefinirSenhaComTokenDto {
  @ApiProperty({ description: 'Token recebido por e-mail.' })
  @IsString()
  token!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
  @MaxLength(128)
  novaSenha!: string;
}
