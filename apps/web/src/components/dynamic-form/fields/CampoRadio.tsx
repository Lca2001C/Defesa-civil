import {
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
} from "@mui/material";
import type { FieldProps } from "../types";

export function CampoRadio({ campo, field, error }: FieldProps) {
  return (
    <FormControl error={!!error} required={campo.obrigatorio} component="fieldset" fullWidth sx={{ minWidth: 0 }}>
      <FormLabel sx={{ fontSize: 14 }}>{campo.rotulo}</FormLabel>
      <RadioGroup value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value)}>
        {campo.opcoes?.map((o) => (
          <FormControlLabel
            key={o.valor}
            value={o.valor}
            control={<Radio size="small" />}
            label={o.rotulo}
          />
        ))}
      </RadioGroup>
      {(error || campo.ajuda) && (
        <FormHelperText>{error?.message ?? campo.ajuda}</FormHelperText>
      )}
    </FormControl>
  );
}
