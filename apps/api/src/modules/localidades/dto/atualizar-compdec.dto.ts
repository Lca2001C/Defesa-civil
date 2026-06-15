import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

function emptyToNull({ value }: { value: unknown }) {
  return value === '' ? null : value;
}

export class AtualizarCompdecDto {
  @ApiPropertyOptional({ example: 'João Silva' })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((o: AtualizarCompdecDto) => o.coordenadorNome !== null)
  @IsString()
  @MaxLength(150)
  coordenadorNome?: string | null;

  @ApiPropertyOptional({ example: 'joao.silva@prefeitura.mg.gov.br' })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((o: AtualizarCompdecDto) => o.email !== null)
  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(200)
  email?: string | null;

  @ApiPropertyOptional({ example: '(31) 99999-0000' })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((o: AtualizarCompdecDto) => o.telefone !== null)
  @IsString()
  @MaxLength(30)
  telefone?: string | null;
}
