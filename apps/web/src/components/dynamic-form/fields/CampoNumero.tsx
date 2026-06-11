import { InputAdornment, TextField } from "@mui/material";
import { TipoCampo } from "@dcmg/contracts";
import type { FieldProps } from "../types";

export function CampoNumero({ campo, field, error }: FieldProps) {
  const isMoeda = campo.tipo === TipoCampo.MOEDA;
  return (
    <TextField
      {...field}
      type="number"
      label={campo.rotulo}
      helperText={error?.message ?? campo.ajuda}
      error={!!error}
      required={campo.obrigatorio}
      fullWidth
      size="small"
      InputProps={
        isMoeda
          ? { startAdornment: <InputAdornment position="start">R$</InputAdornment> }
          : undefined
      }
      onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
    />
  );
}
