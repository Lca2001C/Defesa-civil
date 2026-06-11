import {
  FormControl,
  FormControlLabel,
  FormHelperText,
  Switch,
} from "@mui/material";
import type { FieldProps } from "../types";

export function CampoBooleano({ campo, field, error }: FieldProps) {
  return (
    <FormControl error={!!error} required={campo.obrigatorio}>
      <FormControlLabel
        control={
          <Switch
            checked={!!field.value}
            onChange={(e) => field.onChange(e.target.checked)}
            color="primary"
          />
        }
        label={campo.rotulo}
      />
      {(error || campo.ajuda) && (
        <FormHelperText>{error?.message ?? campo.ajuda}</FormHelperText>
      )}
    </FormControl>
  );
}
