import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import AssignmentIcon from "@mui/icons-material/Assignment";
import { useQuery } from "@tanstack/react-query";
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
  ENVIADA: "info",
  EM_ANALISE: "warning",
  CORRECAO_SOLICITADA: "error",
  REVISADA: "warning",
  VALIDADA: "success",
  REJEITADA: "error",
};

const LABEL_STATUS: Record<string, string> = {
  RASCUNHO: "Rascunho",
  ENVIADA: "Enviada",
  EM_ANALISE: "Em análise",
  CORRECAO_SOLICITADA: "Correção solicitada",
  REVISADA: "Revisada",
  VALIDADA: "Validada",
  REJEITADA: "Rejeitada",
};

export default function SubmissoesPage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const podeCriar = usuario?.permissoes.includes("submissoes.criar") ?? false;
  const [statusFiltro, setStatusFiltro] = useState("");

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
        {data?.items.map((s) => (
          <Card key={s.id}>
            <CardActionArea onClick={() => navigate(`/submissoes/${s.id}`)}>
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
          </Card>
        ))}
      </Box>
    </Box>
  );
}
