import { ApiProperty } from '@nestjs/swagger';

export class TokensDto {
  @ApiProperty({ description: 'JWT de acesso (Bearer), expira em expiresIn segundos.' })
  accessToken!: string;

  @ApiProperty({ description: 'Token opaco para renovar o access token.' })
  refreshToken!: string;

  @ApiProperty({ description: 'Tempo de vida do access token em segundos.' })
  expiresIn!: number;

  @ApiProperty({ default: 'Bearer' })
  tipo!: string;
}
