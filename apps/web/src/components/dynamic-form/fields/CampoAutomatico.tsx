import { TextField } from "@mui/material";
import { FonteAutomatica } from "@dcmg/contracts";
import type { FieldProps } from "../types";

const ROTULO_FONTE: Record<string, string> = {
  [FonteAutomatica.CODIGO_IBGE]: "Preenchido automaticamente (código IBGE)",
  [FonteAutomatica.MUNICIPIO_ATUAL]: "Preenchido automaticamente (município)",
  [FonteAutomatica.USUARIO_ATUAL]: "Preenchido automaticamente (usuário)",
  [FonteAutomatica.DATA_ATUAL]: "Preenchido automaticamente (data)",
  [FonteAutomatica.ANO_ATUAL]: "Preenchido automaticamente (ano)",
  [FonteAutomatica.COMPETENCIA_ATUAL]: "Preenchido automaticamente (competência)",
  [FonteAutomatica.PROTOCOLO]: "Gerado automaticamente no envio",
};

/** Campo somente leitura, preenchido pelo servidor. */
export function CampoAutomatico({ campo, field }: FieldProps) {
  const dica = campo.fonteAutomatica
    ? ROTULO_FONTE[campo.fonteAutomatica] ?? "Preenchido automaticamente"
    : "Preenchido automaticamente";
  return (
    <TextField
      label={campo.rotulo}
      value={field.value ?? ""}
      helperText={campo.ajuda ?? dica}
      fullWidth
      size="small"
      InputProps={{ readOnly: true }}
      disabled
    />
  );
}
