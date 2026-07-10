import { Alert, Box, Typography } from "@mui/material";
import { VarianteInformativo } from "@dcmg/contracts";
import type { FieldProps } from "../types";

/**
 * Componente INFORMATIVO — NÃO é um campo de resposta. Exibe título, descrição
 * ou alerta para orientar o preenchimento. Ignora `field` (react-hook-form) de
 * propósito: não coleta valor. O texto vem de `campo.rotulo`; a aparência de
 * `campo.variante`.
 */
export function CampoInformativo({ campo }: FieldProps) {
  const texto = campo.rotulo;

  if (campo.variante === VarianteInformativo.ALERTA) {
    return (
      <Alert severity="warning" sx={{ whiteSpace: "pre-wrap" }}>
        {texto}
        {campo.ajuda && (
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {campo.ajuda}
          </Typography>
        )}
      </Alert>
    );
  }

  if (campo.variante === VarianteInformativo.TITULO) {
    return (
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {texto}
        </Typography>
        {campo.ajuda && (
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
            {campo.ajuda}
          </Typography>
        )}
      </Box>
    );
  }

  // Padrão: descrição (texto de apoio).
  return (
    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
      {texto}
      {campo.ajuda ? `\n${campo.ajuda}` : ""}
    </Typography>
  );
}
