import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class PublicarVersaoDto {
  @ApiProperty({
    description: 'ID da competência a vincular. Deve estar com status ABERTA.',
  })
  @IsString()
  @IsNotEmpty()
  competenciaId!: string;
}
