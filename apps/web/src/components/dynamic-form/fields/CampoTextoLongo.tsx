import { TextField } from "@mui/material";
import type { FieldProps } from "../types";

export function CampoTextoLongo({ campo, field, error }: FieldProps) {
  return (
    <TextField
      {...field}
      value={field.value ?? ""}
      label={campo.rotulo}
      helperText={error?.message ?? campo.ajuda}
      error={!!error}
      required={campo.obrigatorio}
      fullWidth
      size="small"
      multiline
      minRows={3}
    />
  );
}
