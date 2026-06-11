import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RedefinirSenhaDto {
  @ApiProperty({ example: 'NovaSenha@2026!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  novaSenha!: string;
}
