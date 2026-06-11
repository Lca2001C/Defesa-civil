import { TextField } from "@mui/material";
import type { FieldProps } from "../types";

export function CampoTexto({ campo, field, error }: FieldProps) {
  return (
    <TextField
      {...field}
      label={campo.rotulo}
      helperText={error?.message ?? campo.ajuda}
      error={!!error}
      required={campo.obrigatorio}
      fullWidth
      size="small"
    />
  );
}
