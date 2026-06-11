import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  FormLabel,
} from "@mui/material";
import type { FieldProps } from "../types";

/** Múltipla escolha — armazena array de valores. */
export function CampoCheckbox({ campo, field, error }: FieldProps) {
  const valores: string[] = Array.isArray(field.value) ? (field.value as string[]) : [];

  function alternar(valor: string, marcado: boolean) {
    field.onChange(marcado ? [...valores, valor] : valores.filter((v) => v !== valor));
  }

  return (
    <FormControl error={!!error} required={campo.obrigatorio} component="fieldset">
      <FormLabel sx={{ fontSize: 14 }}>{campo.rotulo}</FormLabel>
      <FormGroup>
        {campo.opcoes?.map((o) => (
          <FormControlLabel
            key={o.valor}
            control={
              <Checkbox
                size="small"
                checked={valores.includes(o.valor)}
                onChange={(e) => alternar(o.valor, e.target.checked)}
              />
            }
            label={o.rotulo}
          />
        ))}
      </FormGroup>
      {(error || campo.ajuda) && (
        <FormHelperText>{error?.message ?? campo.ajuda}</FormHelperText>
      )}
    </FormControl>
  );
}
