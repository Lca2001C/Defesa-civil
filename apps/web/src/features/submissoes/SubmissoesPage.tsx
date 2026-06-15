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
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import AssignmentIcon from "@mui/icons-material/Assignment";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

interface Submissao {
  id: string;
  protocolo: string;
  status: string;
  nomeRespondente: string;
  criadoEm: string;
  enviadoEm: string | null;
  municipio: { nome: string };
  formularioVersao: { versao: number; formulario: { nome: string } };
  _count: { revisoes: number };
}

interface Listagem {
  items: Submissao[];
  total: number;
  pagina: number;
  totalPaginas: number;
}

const COR_STATUS: Record<string, "default" | "info" | "warning" | "success" | "error"> = {
  RASCUNHO: "default",
  EM_PREENCHIMENTO: "info",
  ENVIADO: "info",
  CORRECAO_SOLICITADA: "error",
  REVISADO: "warning",
  APROVADO: "success",
};

const LABEL_STATUS: Record<string, string> = {
  RASCUNHO: "Rascunho",
  EM_PREENCHIMENTO: "Em preenchimento",
  ENVIADO: "Enviado",
  CORRECAO_SOLICITADA: "Correção solicitada",
  REVISADO: "Revisado",
  APROVADO: "Aprovado",
};

const STATUS_EXCLUIVEIS = new Set(["RASCUNHO", "EM_PREENCHIMENTO"]);

export default function SubmissoesPage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const podeCriar = usuario?.permissoes.includes("submissoes.criar") ?? false;
  const isAdmin = (usuario?.perfilNivel ?? 0) >= 80;
  const [statusFiltro, setStatusFiltro] = useState("");
  const [excluindo, setExcluindo] = useState<Submissao | null>(null);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const mutarExcluir = useMutation({
    mutationFn: (id: string) => api.delete(`/submissoes/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["submissoes"] });
      setExcluindo(null);
      setErroExclusao(null);
    },
    onError: (err: unknown) => {
      setErroExclusao(err instanceof Error ? err.message : "Erro ao excluir submissão.");
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["submissoes", statusFiltro],
    queryFn: () =>
      api.get<Listagem>(
        `/submissoes?porPagina=50${statusFiltro ? `&status=${statusFiltro}` : ""}`,
      ),
  });

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h5">Submissões</Typography>
          <Typography variant="body2" color="text.secondary">
            {data ? `${data.total} registro(s)` : "Carregando…"}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFiltro}
              label="Status"
              onChange={(e) => setStatusFiltro(e.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>
              {Object.entries(LABEL_STATUS).map(([k, v]) => (
                <MenuItem key={k} value={k}>{v}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {podeCriar && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate("/submissoes/nova")}
            >
              Nova resposta
            </Button>
          )}
        </Box>
      </Box>

      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {!isLoading && data?.items.length === 0 && (
        <Box sx={{ textAlign: "center", mt: 6, color: "text.secondary" }}>
          <AssignmentIcon sx={{ fontSize: 56, mb: 1, opacity: 0.4 }} />
          <Typography>Nenhuma submissão encontrada.</Typography>
        </Box>
      )}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {data?.items.map((s) => {
          const podeExcluir = isAdmin || STATUS_EXCLUIVEIS.has(s.status);
          return (
            <Card key={s.id}>
              <Box sx={{ display: "flex", alignItems: "stretch" }}>
                <CardActionArea onClick={() => navigate(`/submissoes/${s.id}`)} sx={{ flex: 1 }}>
                  <CardContent sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {s.formularioVersao.formulario.nome}{" "}
                        <Typography component="span" variant="caption" color="text.secondary">
                          v{s.formularioVersao.versao}
                        </Typography>
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {s.municipio.nome} · {s.nomeRespondente}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Protocolo: <strong>{s.protocolo}</strong>
                        {s.enviadoEm &&
                          ` · Enviado em ${new Date(s.enviadoEm).toLocaleDateString("pt-BR")}`}
                      </Typography>
                    </Box>
                    <Chip
                      label={LABEL_STATUS[s.status] ?? s.status}
                      color={COR_STATUS[s.status] ?? "default"}
                      size="small"
                    />
                  </CardContent>
                </CardActionArea>
                {podeExcluir && (
                  <Box sx={{ display: "flex", alignItems: "center", px: 1 }}>
                    <Tooltip title="Excluir submissão">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => { setExcluindo(s); setErroExclusao(null); }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Box>
            </Card>
          );
        })}
      </Box>

      <Dialog
        open={!!excluindo}
        onClose={() => { setExcluindo(null); setErroExclusao(null); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Excluir submissão?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Excluir a submissão do formulário{" "}
            <strong>{excluindo?.formularioVersao.formulario.nome}</strong> do município{" "}
            <strong>{excluindo?.municipio.nome}</strong>? Esta ação não pode ser desfeita.
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
