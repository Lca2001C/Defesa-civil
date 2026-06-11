import { PartialType } from '@nestjs/swagger';
import { CriarCompetenciaDto } from './criar-competencia.dto';

export class AtualizarCompetenciaDto extends PartialType(CriarCompetenciaDto) {}
