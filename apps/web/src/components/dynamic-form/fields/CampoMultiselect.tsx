import {
  Chip,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
} from "@mui/material";
import type { FieldProps } from "../types";

export function CampoMultiselect({ campo, field, error }: FieldProps) {
  const valores: string[] = Array.isArray(field.value) ? (field.value as string[]) : [];

  return (
    <FormControl fullWidth size="small" error={!!error} required={campo.obrigatorio}>
      <InputLabel>{campo.rotulo}</InputLabel>
      <Select
        {...field}
        multiple
        value={valores}
        input={<OutlinedInput label={campo.rotulo} />}
        renderValue={(selecionados) => (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {(selecionados as string[]).map((v) => (
              <Chip
                key={v}
                label={campo.opcoes?.find((o) => o.valor === v)?.rotulo ?? v}
                size="small"
              />
            ))}
          </div>
        )}
      >
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
