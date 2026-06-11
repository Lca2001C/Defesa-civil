import { Box, FormHelperText, Typography } from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import type { FieldProps } from "../types";

/** Placeholder — upload completo implementado no Passo 5 (Storage). */
export function CampoArquivo({ campo, error }: FieldProps) {
  return (
    <Box>
      <Box
        sx={{
          border: "1px dashed",
          borderColor: error ? "error.main" : "divider",
          borderRadius: 2,
          p: 2,
          display: "flex",
          alignItems: "center",
          gap: 1,
          color: "text.secondary",
        }}
      >
        <UploadFileIcon fontSize="small" />
        <Typography variant="body2">
          {campo.rotulo}
          {campo.obrigatorio && " *"}
          {" — upload disponível em breve"}
        </Typography>
      </Box>
      {(error || campo.ajuda) && (
        <FormHelperText error={!!error}>{error?.message ?? campo.ajuda}</FormHelperText>
      )}
    </Box>
  );
}
