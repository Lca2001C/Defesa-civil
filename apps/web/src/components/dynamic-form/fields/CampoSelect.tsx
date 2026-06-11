import {
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";
import type { FieldProps } from "../types";

export function CampoSelect({ campo, field, error }: FieldProps) {
  return (
    <FormControl fullWidth size="small" error={!!error} required={campo.obrigatorio}>
      <InputLabel>{campo.rotulo}</InputLabel>
      <Select {...field} label={campo.rotulo} value={field.value ?? ""}>
        {campo.opcoes?.map((o) => (
          <MenuItem key={o.valor} value={o.valor}>
            {o.rotulo}
          </MenuItem>
        ))}
      </Select>
      {(error || campo.ajuda) && (
        <FormHelperText>{error?.message ?? campo.ajuda}</FormHelperText>
      )}
    </FormControl>
  );
}
