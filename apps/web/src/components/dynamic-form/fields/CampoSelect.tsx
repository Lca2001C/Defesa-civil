import {
  Box,
  Chip,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";
import type { FieldProps } from "../types";

export function CampoSelect({ campo, field, error }: FieldProps) {
  const multipla = campo.multipla === true;
  const rotuloPorValor = new Map((campo.opcoes ?? []).map((o) => [o.valor, o.rotulo]));

  return (
    <FormControl fullWidth size="small" error={!!error} required={campo.obrigatorio}>
      <InputLabel>{campo.rotulo}</InputLabel>
      <Select
        {...field}
        label={campo.rotulo}
        multiple={multipla}
        // Multipla: valor e array (mesmo shape do CHECKBOX); simples: string.
        value={field.value ?? (multipla ? [] : "")}
        renderValue={
          multipla
            ? (selecionados) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {(selecionados as string[]).map((v) => (
                    <Chip key={v} label={rotuloPorValor.get(v) ?? v} size="small" />
                  ))}
                </Box>
              )
            : undefined
        }
      >
        {campo.opcoes?.map((o) => (
          <MenuItem key={o.valor} value={o.valor}>
            {o.rotulo}
          </MenuItem>
        ))}
      </Select>
      {(error || campo.ajuda) && (
        <FormHelperText sx={{ whiteSpace: "pre-wrap" }}>
          {error?.message ?? campo.ajuda}
        </FormHelperText>
      )}
    </FormControl>
  );
}
