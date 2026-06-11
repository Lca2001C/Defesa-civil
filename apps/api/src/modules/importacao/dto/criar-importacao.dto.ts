import { IsNotEmpty, IsString, IsOptional, IsInt, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class CriarImportacaoDto {
  @IsString()
  @IsNotEmpty()
  formularioVersaoId!: string;

  @IsString()
  @IsNotEmpty()
  competenciaId!: string;

  /** Municípios para todos os registros do lote (opcional; pode vir na planilha). */
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  municipioId?: number;

  /**
   * Mapeamento manual: { "Coluna Excel": "chave_campo" }.
   * Se omitido, o sistema tenta inferir pelos cabeçalhos.
   */
  @IsOptional()
  @IsObject()
  mapeamento?: Record<string, string>;
}
