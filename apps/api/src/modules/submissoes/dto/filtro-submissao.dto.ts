import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumberString, IsOptional, IsUUID } from 'class-validator';
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

  @ApiPropertyOptional({ enum: SubmissaoStatus })
  @IsOptional()
  @IsEnum(SubmissaoStatus)
  status?: SubmissaoStatus;
}
