import { TextField } from "@mui/material";
import type { FieldProps } from "../types";

export function CampoData({ campo, field, error }: FieldProps) {
  return (
    <TextField
      {...field}
      type="date"
      label={campo.rotulo}
      helperText={error?.message ?? campo.ajuda}
      error={!!error}
      required={campo.obrigatorio}
      fullWidth
      size="small"
      InputLabelProps={{ shrink: true }}
    />
  );
}
