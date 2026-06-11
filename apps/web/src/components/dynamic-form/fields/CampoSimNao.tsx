import {
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
} from "@mui/material";
import type { FieldProps } from "../types";

/** Sim/Não — armazena booleano. */
export function CampoSimNao({ campo, field, error }: FieldProps) {
  const valor = field.value === true ? "sim" : field.value === false ? "nao" : "";
  return (
    <FormControl error={!!error} required={campo.obrigatorio} component="fieldset">
      <FormLabel sx={{ fontSize: 14 }}>{campo.rotulo}</FormLabel>
      <RadioGroup
        row
        value={valor}
        onChange={(e) => field.onChange(e.target.value === "sim")}
      >
        <FormControlLabel value="sim" control={<Radio size="small" />} label="Sim" />
        <FormControlLabel value="nao" control={<Radio size="small" />} label="Não" />
      </RadioGroup>
      {(error || campo.ajuda) && (
        <FormHelperText>{error?.message ?? campo.ajuda}</FormHelperText>
      )}
    </FormControl>
  );
}
