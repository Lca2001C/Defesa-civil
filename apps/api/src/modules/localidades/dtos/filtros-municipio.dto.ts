import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginacaoDto } from '../../../common/dto/paginacao.dto';

export class FiltrosMunicipioDto extends PaginacaoDto {
  @ApiPropertyOptional({ description: 'Filtro por nome (busca parcial, case-insensitive).' })
  @IsOptional()
  @IsString()
  nome?: string;

  @ApiPropertyOptional({ description: 'Filtro por ID da regional (REDEC).' })
  @IsOptional()
  @IsString()
  regionalId?: string;

  @ApiPropertyOptional({ description: 'Filtro por ID da UF.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ufId?: number;
}
