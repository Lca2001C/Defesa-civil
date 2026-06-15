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
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DescriptionIcon from "@mui/icons-material/Description";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

interface Formulario {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  status: string;
  _count: { versoes: number };
  criadoEm: string;
}

interface ListagemFormularios {
  items: Formulario[];
  total: number;
  pagina: number;
  totalPaginas: number;
}

const COR_STATUS: Record<string, "default" | "warning" | "success" | "error"> = {
  RASCUNHO: "default",
  PUBLICADO: "success",
  ARQUIVADO: "error",
};

export default function FormulariosPage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const podeGerenciar = usuario?.permissoes.includes("formularios.criar") ?? false;
  const [excluindo, setExcluindo] = useState<Formulario | null>(null);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["formularios"],
    queryFn: () => api.get<ListagemFormularios>("/formularios?porPagina=50"),
  });

  const mutarExcluir = useMutation({
    mutationFn: (id: string) => api.delete(`/formularios/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["formularios"] });
      setExcluindo(null);
      setErroExclusao(null);
    },
    onError: (err: unknown) => {
      setErroExclusao(err instanceof Error ? err.message : "Erro ao excluir formulário.");
    },
  });

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h5">Formulários</Typography>
          <Typography variant="body2" color="text.secondary">
            {data ? `${data.total} formulário${data.total !== 1 ? "s" : ""} cadastrado${data.total !== 1 ? "s" : ""}` : "Carregando…"}
          </Typography>
        </Box>
        {podeGerenciar && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate("/formularios/novo")}
          >
            Novo formulário
          </Button>
        )}
      </Box>

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
              <CardActionArea onClick={() => navigate(`/formularios/${f.id}`)} sx={{ flex: 1 }}>
                <CardContent sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {f.nome}
                    </Typography>
                    {f.descricao && (
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 500 }}>
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
