import { TextField } from "@mui/material";
import { TipoPergunta } from "@dcmg/contracts";
import type { FieldProps } from "../types";
import { aplicarMascara } from "../masks";

const COM_MASCARA = [
  TipoPergunta.CPF,
  TipoPergunta.CNPJ,
  TipoPergunta.CEP,
  TipoPergunta.TELEFONE,
];

const TIPO_INPUT: Partial<Record<TipoPergunta, string>> = {
  [TipoPergunta.EMAIL]: "email",
  [TipoPergunta.URL]: "url",
};

export function CampoTexto({ campo, field, error }: FieldProps) {
  const temMascara = COM_MASCARA.includes(campo.tipo);
  return (
    <TextField
      {...field}
      value={field.value ?? ""}
      type={TIPO_INPUT[campo.tipo] ?? "text"}
      label={campo.rotulo}
      helperText={error?.message ?? campo.ajuda}
      error={!!error}
      required={campo.obrigatorio}
      fullWidth
      size="small"
      onChange={(e) =>
        field.onChange(temMascara ? aplicarMascara(campo.tipo, e.target.value) : e.target.value)
      }
    />
  );
}
