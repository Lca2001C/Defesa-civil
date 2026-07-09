// Diálogo de importação de formulário via Excel. O usuário baixa a planilha-
// modelo, preenche (ou adapta o Excel oficial da CEDEC) e importa: a API cria
// um formulário RASCUNHO, que abre no builder para revisão antes de publicar.

import { useState } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Link,
  List,
  ListItem,
  ListItemText,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../lib/api";
import { FormulariosService } from "./services/formularios.service";
import type { CriacaoResp } from "./types";

interface Props {
  aberto: boolean;
  onFechar: () => void;
}

interface ErroLinha {
  linha: number;
  mensagem: string;
}

/** Extrai os erros por linha do corpo do ApiError (400 da importação). */
function extrairErros(err: unknown): { mensagem: string; linhas: ErroLinha[] } {
  if (err instanceof ApiError && err.body && typeof err.body === "object") {
    const body = err.body as { message?: string; erros?: ErroLinha[] };
    return { mensagem: body.message ?? err.message, linhas: body.erros ?? [] };
  }
  const mensagem = err instanceof Error ? err.message : "Falha ao importar a planilha.";
  return { mensagem, linhas: [] };
}

export function ImportarExcelDialog({ aberto, onFechar }: Props) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<{ mensagem: string; linhas: ErroLinha[] } | null>(null);

  const baixarModelo = useMutation({
    mutationFn: () => FormulariosService.baixarModeloImportacao(),
    onError: () => setErro({ mensagem: "Não foi possível baixar a planilha-modelo.", linhas: [] }),
  });

  const importar = useMutation({
    mutationFn: (file: File) => FormulariosService.importarExcel(file),
    onSuccess: (resp: CriacaoResp) => {
      onFechar();
      // Abre o rascunho recém-criado para revisão no builder.
      navigate(`/formularios/${resp.id}/versoes/${resp.versaoInicialId}/editar`);
    },
    onError: (err) => setErro(extrairErros(err)),
  });

  function fechar() {
    setArquivo(null);
    setErro(null);
    onFechar();
  }

  return (
    <Dialog open={aberto} onClose={fechar} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle>Importar formulário via Excel</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Baixe a planilha-modelo, preencha uma linha por pergunta (ou adapte o Excel oficial ao
          modelo) e envie. Será criado um <strong>rascunho</strong> para você revisar antes de publicar.
        </DialogContentText>

        <Button
          startIcon={<DownloadIcon />}
          variant="outlined"
          onClick={() => baixarModelo.mutate()}
          disabled={baixarModelo.isPending}
          sx={{ mb: 2, width: { xs: "100%", sm: "auto" } }}
        >
          {baixarModelo.isPending ? "Gerando…" : "Baixar planilha-modelo"}
        </Button>

        <Box>
          <Button
            component="label"
            startIcon={<UploadFileIcon />}
            variant={arquivo ? "outlined" : "contained"}
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            {arquivo ? "Trocar arquivo" : "Selecionar planilha (.xlsx)"}
            <input
              type="file"
              hidden
              accept=".xlsx"
              onChange={(e) => {
                setArquivo(e.target.files?.[0] ?? null);
                setErro(null);
              }}
            />
          </Button>
          {arquivo && (
            <Typography component="span" variant="body2" sx={{ ml: 1.5, wordBreak: "break-all" }}>
              {arquivo.name}
            </Typography>
          )}
        </Box>

        {erro && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <AlertTitle>{erro.mensagem}</AlertTitle>
            {erro.linhas.length > 0 && (
              <List dense disablePadding>
                {erro.linhas.slice(0, 30).map((e, i) => (
                  <ListItem key={i} disableGutters sx={{ py: 0 }}>
                    <ListItemText primary={`Linha ${e.linha}: ${e.mensagem}`} />
                  </ListItem>
                ))}
                {erro.linhas.length > 30 && (
                  <ListItem disableGutters sx={{ py: 0 }}>
                    <ListItemText primary={`… e mais ${erro.linhas.length - 30} erro(s).`} />
                  </ListItem>
                )}
              </List>
            )}
          </Alert>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
          Dúvidas sobre as colunas? Veja a aba <strong>Instrucoes</strong> da planilha-modelo, ou a{" "}
          <Link href="/docs/FORMULARIOS.md" target="_blank" rel="noopener">
            documentação do motor de formulários
          </Link>
          .
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={fechar}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={!arquivo || importar.isPending}
          onClick={() => arquivo && importar.mutate(arquivo)}
        >
          {importar.isPending ? <CircularProgress size={20} color="inherit" /> : "Importar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
