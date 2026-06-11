import type { ComponentType } from "react";
import { TipoCampo } from "@dcmg/contracts";
import type { FieldProps } from "./types";
import { CampoArquivo } from "./fields/CampoArquivo";
import { CampoBooleano } from "./fields/CampoBooleano";
import { CampoData } from "./fields/CampoData";
import { CampoMultiselect } from "./fields/CampoMultiselect";
import { CampoNumero } from "./fields/CampoNumero";
import { CampoSelect } from "./fields/CampoSelect";
import { CampoTexto } from "./fields/CampoTexto";

/** Mapa de TipoCampo → componente MUI. */
export const REGISTRY: Record<TipoCampo, ComponentType<FieldProps>> = {
  [TipoCampo.TEXTO]: CampoTexto,
  [TipoCampo.CPF]: CampoTexto,
  [TipoCampo.CNPJ]: CampoTexto,
  [TipoCampo.CEP]: CampoTexto,
  [TipoCampo.NUMERO]: CampoNumero,
  [TipoCampo.MOEDA]: CampoNumero,
  [TipoCampo.DATA]: CampoData,
  [TipoCampo.SELECT]: CampoSelect,
  [TipoCampo.MULTISELECT]: CampoMultiselect,
  [TipoCampo.BOOLEANO]: CampoBooleano,
  [TipoCampo.ARQUIVO]: CampoArquivo,
};
