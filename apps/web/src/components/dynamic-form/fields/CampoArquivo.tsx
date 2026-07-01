import { useRef, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  FormHelperText,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import DeleteIcon from "@mui/icons-material/Delete";
import type { FieldProps } from "../types";
import { ACCEPT_TIPOS } from "../../../shared/constants";

export function CampoArquivo({ campo, field, error, onUpload }: FieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [carregando, setCarregando] = useState(false);
  const [erroUpload, setErroUpload] = useState<string | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [tamanhoKb, setTamanhoKb] = useState<number | undefined>();

  const temArquivo = !!(nomeArquivo || (typeof field.value === "string" && field.value.length > 0));
  const mensagemErro = erroUpload ?? error?.message;

  async function handleFile(file: File) {
    if (!onUpload) return;
    setCarregando(true);
    setErroUpload(null);
    try {
      const resultado = await onUpload(file, campo.codigo);
      setNomeArquivo(resultado.nome);
      setTamanhoKb(resultado.tamanhoKb);
      field.onChange(resultado.id);
    } catch (e) {
      setErroUpload((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  function remover() {
    setNomeArquivo(null);
    setTamanhoKb(undefined);
    setErroUpload(null);
    field.onChange("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <Box>
      <Box
        sx={{
          border: "1px dashed",
          borderColor: mensagemErro
            ? "error.main"
            : temArquivo
              ? "success.main"
              : "divider",
          borderRadius: 2,
          px: 2,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 1,
          minHeight: 52,
        }}
      >
        {/* Sem callback de upload: modo preview */}
        {!onUpload && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1, minWidth: 0, color: "text.disabled" }}>
            <UploadFileIcon fontSize="small" sx={{ flexShrink: 0 }} />
            <Typography variant="body2">
              {campo.rotulo}
              {campo.obrigatorio && " *"}
              {" — disponível ao preencher o formulário"}
            </Typography>
          </Box>
        )}

        {/* Arquivo já carregado */}
        {onUpload && temArquivo && (
          <>
            <AttachFileIcon fontSize="small" sx={{ color: "success.main", flexShrink: 0 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {nomeArquivo ?? "Arquivo vinculado"}
              </Typography>
              {tamanhoKb && (
                <Typography variant="caption" color="text.secondary">
                  {tamanhoKb} KB
                </Typography>
              )}
            </Box>
            <Tooltip title="Remover arquivo">
              <IconButton size="small" color="error" onClick={remover}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}

        {/* Sem arquivo — botão de seleção */}
        {onUpload && !temArquivo && (
          <>
            <UploadFileIcon
              fontSize="small"
              sx={{ color: mensagemErro ? "error.main" : "text.secondary", flexShrink: 0 }}
            />
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {campo.rotulo}
              {campo.obrigatorio && " *"}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              color={mensagemErro ? "error" : "primary"}
              onClick={() => inputRef.current?.click()}
              disabled={carregando}
              startIcon={carregando ? <CircularProgress size={14} color="inherit" /> : <UploadFileIcon />}
              sx={{ flexShrink: 0 }}
            >
              {carregando ? "Enviando…" : "Carregar arquivo"}
            </Button>
          </>
        )}
      </Box>

      <input
        ref={inputRef}
        type="file"
        hidden
        accept={ACCEPT_TIPOS}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />

      {(mensagemErro ?? campo.ajuda) && (
        <FormHelperText error={!!mensagemErro}>
          {mensagemErro ?? campo.ajuda}
        </FormHelperText>
      )}
    </Box>
  );
}
