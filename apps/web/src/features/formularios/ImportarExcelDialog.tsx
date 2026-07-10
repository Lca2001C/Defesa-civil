// Diálogo de importação de formulário via Excel (formato Defesa Civil MG).
// Fluxo: Selecionar .xlsx → Preview (contagens + seções/perguntas + erros) →
// Confirmar. A planilha é só molde: a API cria um formulário NATIVO (rascunho),
// que abre no construtor visual. Nada da planilha permanece após a importação.

import { useState } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ROTULO_TIPO } from "./builder/tipos";
import { ApiError } from "../../lib/api";
import { FormulariosService } from "./services/formularios.service";
import type { CriacaoResp, ResultadoImportacao } from "./types";

interface Props {
  aberto: boolean;
  onFechar: () => void;
}

function mensagemErro(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return err instanceof Error ? err.message : "Falha ao processar a planilha.";
}

export function ImportarExcelDialog({ aberto, onFechar }: Props) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<ResultadoImportacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const baixarModelo = useMutation({
    mutationFn: () => FormulariosService.baixarModeloImportacao(),
    onError: () => setErro("Não foi possível baixar a planilha-modelo."),
  });

  const gerarPrevia = useMutation({
    mutationFn: (file: File) => FormulariosService.previaImportacao(file),
    onSuccess: (r) => { setPrevia(r); setErro(null); },
    onError: (e) => { setErro(mensagemErro(e)); setPrevia(null); },
  });

  const importar = useMutation({
    mutationFn: (file: File) => FormulariosService.importarExcel(file),
    onSuccess: (resp: CriacaoResp) => {
      fechar();
      navigate(`/formularios/${resp.id}/versoes/${resp.versaoInicialId}/editar`);
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  function fechar() {
    setArquivo(null);
    setPrevia(null);
    setErro(null);
    onFechar();
  }

  function selecionar(file: File | null) {
    setArquivo(file);
    setPrevia(null);
    setErro(null);
    if (file) gerarPrevia.mutate(file);
  }

  const temErros = (previa?.erros.length ?? 0) > 0;
  const podeImportar = !!previa && !temErros && !importar.isPending;

  return (
    <Dialog open={aberto} onClose={fechar} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle>Importar formulário (Excel)</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Selecione a planilha no padrão da Defesa Civil MG (cada aba vira uma seção). Ela é apenas o
          molde: será criado um <strong>rascunho</strong> nativo, editável no construtor. Nada da
          planilha permanece depois.
        </DialogContentText>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
          <Button
            startIcon={<DownloadIcon />}
            variant="outlined"
            onClick={() => baixarModelo.mutate()}
            disabled={baixarModelo.isPending}
          >
            {baixarModelo.isPending ? "Gerando…" : "Baixar planilha-modelo"}
          </Button>
          <Button component="label" startIcon={<UploadFileIcon />} variant={arquivo ? "outlined" : "contained"}>
            {arquivo ? "Trocar arquivo" : "Selecionar .xlsx"}
            <input
              type="file"
              hidden
              accept=".xlsx"
              onChange={(e) => selecionar(e.target.files?.[0] ?? null)}
            />
          </Button>
        </Stack>

        {arquivo && (
          <Typography variant="body2" sx={{ mb: 1, wordBreak: "break-all" }}>
            Arquivo: <strong>{arquivo.name}</strong>
          </Typography>
        )}

        {gerarPrevia.isPending && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, my: 2 }}>
            <CircularProgress size={18} /> <Typography variant="body2">Analisando a planilha…</Typography>
          </Box>
        )}

        {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}

        {previa && (
          <Box>
            <Divider sx={{ mb: 1.5 }} />
            <Typography variant="subtitle2" gutterBottom>
              Prévia: {previa.nome}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
              <Chip size="small" label={`${previa.resumo.secoes} seções`} />
              <Chip size="small" label={`${previa.resumo.perguntas} perguntas`} />
              <Chip size="small" label={`${previa.resumo.listas} listas`} />
              <Chip size="small" label={`${previa.resumo.regras} regras`} />
            </Stack>

            {temErros && (
              <Alert severity="warning" sx={{ mb: 1.5 }}>
                <AlertTitle>Pendências a resolver antes de importar</AlertTitle>
                <List dense disablePadding>
                  {previa.erros.slice(0, 30).map((e, i) => (
                    <ListItem key={i} disableGutters sx={{ py: 0 }}>
                      <ListItemText primary={e} />
                    </ListItem>
                  ))}
                  {previa.erros.length > 30 && (
                    <ListItem disableGutters sx={{ py: 0 }}>
                      <ListItemText primary={`… e mais ${previa.erros.length - 30}.`} />
                    </ListItem>
                  )}
                </List>
              </Alert>
            )}

            {/* Árvore de seções → perguntas (tipo de cada). */}
            <Box sx={{ maxHeight: 260, overflow: "auto", border: 1, borderColor: "divider", borderRadius: 1, p: 1 }}>
              {(previa.schema.paginas ?? []).flatMap((pg) => pg.secoes ?? []).map((secao, si) => (
                <Box key={si} sx={{ mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {secao.titulo}
                  </Typography>
                  <List dense disablePadding sx={{ pl: 1.5 }}>
                    {secao.perguntas.map((p, pi) => (
                      <ListItem key={pi} disableGutters sx={{ py: 0 }}>
                        <ListItemText
                          primary={p.rotulo}
                          secondary={ROTULO_TIPO[p.tipo] ?? p.tipo}
                          primaryTypographyProps={{ variant: "body2" }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={fechar}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={!podeImportar}
          onClick={() => arquivo && importar.mutate(arquivo)}
        >
          {importar.isPending ? <CircularProgress size={20} color="inherit" /> : "Criar formulário"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
