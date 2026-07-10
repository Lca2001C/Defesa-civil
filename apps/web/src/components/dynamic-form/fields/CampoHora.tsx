import { TextField } from "@mui/material";
import type { FieldProps } from "../types";

/** Campo de hora (HH:MM, 24h) — input nativo type="time". */
export function CampoHora({ campo, field, error }: FieldProps) {
  return (
    <TextField
      {...field}
      type="time"
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
