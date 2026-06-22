import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { SubmissaoStatus } from '@prisma/client';
import { PaginacaoDto } from '../../../common/dto/paginacao.dto';

export class FiltroSubmissaoDto extends PaginacaoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  competenciaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  formularioVersaoId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  municipioId?: string;

  @ApiPropertyOptional({ description: 'ID da regional (REDEC) para filtrar municípios.' })
  @IsOptional()
  @IsUUID()
  regionalId?: string;

  @ApiPropertyOptional({ enum: SubmissaoStatus })
  @IsOptional()
  @IsEnum(SubmissaoStatus)
  status?: SubmissaoStatus;

  @ApiPropertyOptional({
    description: 'Busca textual por protocolo, respondente, CPF, e-mail ou nome do município.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  busca?: string;

  @ApiPropertyOptional({ description: 'Data inicial (criação) — ISO 8601.' })
  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @ApiPropertyOptional({ description: 'Data final (criação) — ISO 8601.' })
  @IsOptional()
  @IsDateString()
  dataFim?: string;
}
