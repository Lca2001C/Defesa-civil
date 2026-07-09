import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import DescriptionIcon from "@mui/icons-material/Description";
import DeleteIcon from "@mui/icons-material/Delete";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth-context";
import { NIVEL_MODULO_ADMIN, QUERY_KEYS } from "../../shared/constants";
import { FormulariosService } from "./services/formularios.service";
import { ImportarExcelDialog } from "./ImportarExcelDialog";
import type { Formulario } from "./types";

const COR_STATUS: Record<string, "default" | "warning" | "success" | "error"> = {
  RASCUNHO: "default",
  PUBLICADO: "success",
  ARQUIVADO: "error",
};

export default function FormulariosPage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  // Módulo admin: criar/excluir formulários é só de Gestor Estadual (80) e Super
  // Admin (100). O backend impõe por nível (@NivelMinimo); aqui só ocultamos a UI.
  const podeGerenciar = (usuario?.perfilNivel ?? 0) >= NIVEL_MODULO_ADMIN;
  const [excluindo, setExcluindo] = useState<Formulario | null>(null);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.FORMULARIOS],
    queryFn: () => FormulariosService.listar(),
  });

  const mutarExcluir = useMutation({
    mutationFn: (id: string) => FormulariosService.excluir(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QUERY_KEYS.FORMULARIOS] });
      setExcluindo(null);
      setErroExclusao(null);
    },
    onError: (err: unknown) => {
      setErroExclusao(err instanceof Error ? err.message : "Erro ao excluir formulário.");
    },
  });

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          flexWrap: "wrap",
          gap: 2,
          mb: 3,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5">Formulários</Typography>
          <Typography variant="body2" color="text.secondary">
            {data ? `${data.total} formulário${data.total !== 1 ? "s" : ""} cadastrado${data.total !== 1 ? "s" : ""}` : "Carregando…"}
          </Typography>
        </Box>
        {podeGerenciar && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, width: { xs: "100%", sm: "auto" } }}>
            <Button
              variant="outlined"
              startIcon={<UploadFileIcon />}
              onClick={() => setImportando(true)}
              sx={{ flex: { xs: 1, sm: "0 0 auto" } }}
            >
              Importar Excel
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate("/formularios/novo")}
              sx={{ flex: { xs: 1, sm: "0 0 auto" } }}
            >
              Novo formulário
            </Button>
          </Box>
        )}
      </Box>

      <ImportarExcelDialog aberto={importando} onFechar={() => setImportando(false)} />

      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {!isLoading && data?.items.length === 0 && (
        <Box sx={{ textAlign: "center", mt: 6, color: "text.secondary" }}>
          <DescriptionIcon sx={{ fontSize: 56, mb: 1, opacity: 0.4 }} />
          <Typography>Nenhum formulário cadastrado.</Typography>
          {podeGerenciar && (
            <Button sx={{ mt: 2 }} onClick={() => navigate("/formularios/novo")}>
              Criar o primeiro formulário
            </Button>
          )}
        </Box>
      )}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {data?.items.map((f) => (
          <Card key={f.id}>
            <Box sx={{ display: "flex", alignItems: "stretch" }}>
              <CardActionArea onClick={() => navigate(`/formularios/${f.id}`)} sx={{ flex: 1, minWidth: 0 }}>
                <CardContent sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1.5 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {f.nome}
                    </Typography>
                    {f.descricao && (
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: "100%" }}>
                        {f.descricao}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      {f._count.versoes} versão{f._count.versoes !== 1 ? "ões" : ""}
                      {f.categoria ? ` · ${f.categoria}` : ""}
                    </Typography>
                  </Box>
                  <Chip
                    label={f.status}
                    color={COR_STATUS[f.status] ?? "default"}
                    size="small"
                    sx={{ flexShrink: 0 }}
                  />
                </CardContent>
              </CardActionArea>
              {podeGerenciar && (
                <Box sx={{ display: "flex", alignItems: "center", px: 1 }}>
                  <Tooltip title="Excluir formulário">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => { setExcluindo(f); setErroExclusao(null); }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
            </Box>
          </Card>
        ))}
      </Box>

      <Dialog
        open={!!excluindo}
        onClose={() => { setExcluindo(null); setErroExclusao(null); }}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Excluir formulário?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Excluir permanentemente o formulário <strong>{excluindo?.nome}</strong> e todas as suas versões?
            Esta ação não pode ser desfeita. Formulários com submissões não podem ser excluídos.
          </DialogContentText>
          {erroExclusao && <Alert severity="error" sx={{ mt: 2 }}>{erroExclusao}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setExcluindo(null); setErroExclusao(null); }}>Cancelar</Button>
          <Button
            color="error"
            variant="contained"
            disabled={mutarExcluir.isPending}
            onClick={() => excluindo && mutarExcluir.mutate(excluindo.id)}
          >
            {mutarExcluir.isPending ? <CircularProgress size={18} color="inherit" /> : "Excluir"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
