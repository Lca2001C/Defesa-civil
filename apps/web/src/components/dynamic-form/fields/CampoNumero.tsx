import { InputAdornment, TextField } from "@mui/material";
import { TipoPergunta } from "@dcmg/contracts";
import type { FieldProps } from "../types";

export function CampoNumero({ campo, field, error }: FieldProps) {
  const isMoeda = campo.tipo === TipoPergunta.MOEDA;
  const isPorcentagem = campo.tipo === TipoPergunta.PORCENTAGEM;
  return (
    <TextField
      {...field}
      value={field.value ?? ""}
      type="number"
      label={campo.rotulo}
      helperText={error?.message ?? campo.ajuda}
      error={!!error}
      required={campo.obrigatorio}
      fullWidth
      size="small"
      InputProps={{
        ...(isMoeda
          ? { startAdornment: <InputAdornment position="start">R$</InputAdornment> }
          : {}),
        ...(isPorcentagem
          ? { endAdornment: <InputAdornment position="end">%</InputAdornment> }
          : {}),
      }}
      onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
    />
  );
}
