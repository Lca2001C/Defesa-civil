import { PartialType } from '@nestjs/swagger';
import { CriarFormularioDto } from './criar-formulario.dto';

export class AtualizarFormularioDto extends PartialType(CriarFormularioDto) {}
