import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@defesacivil.mg.gov.br' })
  @IsEmail({}, { message: 'E-mail inválido.' })
  email!: string;

  @ApiProperty({ example: 'Defesa@Civil2026!' })
  @IsString()
  @MinLength(8, { message: 'Senha deve ter no mínimo 8 caracteres.' })
  @MaxLength(128)
  senha!: string;
}
