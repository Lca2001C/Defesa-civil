import type { ComponentType } from "react";
import { TipoPergunta } from "@dcmg/contracts";
import type { FieldProps } from "./types";
import { CampoTexto } from "./fields/CampoTexto";
import { CampoTextoLongo } from "./fields/CampoTextoLongo";
import { CampoNumero } from "./fields/CampoNumero";
import { CampoData } from "./fields/CampoData";
import { CampoSelect } from "./fields/CampoSelect";
import { CampoRadio } from "./fields/CampoRadio";
import { CampoCheckbox } from "./fields/CampoCheckbox";
import { CampoSimNao } from "./fields/CampoSimNao";
import { CampoAutomatico } from "./fields/CampoAutomatico";
import { CampoArquivo } from "./fields/CampoArquivo";
import { CampoMunicipio } from "./fields/CampoMunicipio";
import { CampoGrupo } from "./fields/CampoGrupo";
import { CampoHora } from "./fields/CampoHora";
import { CampoInformativo } from "./fields/CampoInformativo";

/** Mapa de TipoPergunta → componente MUI. */
export const REGISTRY: Record<TipoPergunta, ComponentType<FieldProps>> = {
  [TipoPergunta.TEXTO_CURTO]: CampoTexto,
  [TipoPergunta.TEXTO_LONGO]: CampoTextoLongo,
  [TipoPergunta.EMAIL]: CampoTexto,
  [TipoPergunta.TELEFONE]: CampoTexto,
  [TipoPergunta.CPF]: CampoTexto,
  [TipoPergunta.CNPJ]: CampoTexto,
  [TipoPergunta.CEP]: CampoTexto,
  [TipoPergunta.URL]: CampoTexto,
  // ANO e MES_ANO reusam o CampoTexto (mascara/placeholder por tipo).
  [TipoPergunta.ANO]: CampoTexto,
  [TipoPergunta.MES_ANO]: CampoTexto,
  [TipoPergunta.NUMERO]: CampoNumero,
  [TipoPergunta.MOEDA]: CampoNumero,
  [TipoPergunta.PORCENTAGEM]: CampoNumero,
  [TipoPergunta.DATA]: CampoData,
  [TipoPergunta.LISTA_SUSPENSA]: CampoSelect,
  [TipoPergunta.RADIO]: CampoRadio,
  [TipoPergunta.CHECKBOX]: CampoCheckbox,
  [TipoPergunta.SIM_NAO]: CampoSimNao,
  [TipoPergunta.UPLOAD]: CampoArquivo,
  [TipoPergunta.AUTOMATICO]: CampoAutomatico,
  [TipoPergunta.MUNICIPIO]: CampoMunicipio,
  [TipoPergunta.GRUPO]: CampoGrupo,
  [TipoPergunta.HORA]: CampoHora,
  [TipoPergunta.INFORMATIVO]: CampoInformativo,
};
