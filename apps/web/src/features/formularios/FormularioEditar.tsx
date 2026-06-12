import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PublishIcon from "@mui/icons-material/Publish";
import type { SchemaFormulario } from "@dcmg/contracts";
import { api, ApiError } from "../../lib/api";
import { FormularioBuilder } from "./builder/FormularioBuilder";

interface VersaoData {
  id: string;
  versao: number;
  status: string;
  competenciaId: string | null;
  formulario: { id: string; nome: string };
  schema: SchemaFormulario;
}

interface Competencia {
  id: string;
  nome: string;
  status: string;
}

export default function FormularioEditar() {
  const { id, versaoId } = useParams<{ id: string; versaoId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  const [publicarAberto, setPublicarAberto] = useState(false);
  const [competenciaId, setCompetenciaId] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["versao-editar", id, versaoId],
    queryFn: () => api.get<VersaoData>(`/formularios/${id}/versoes/${versaoId}`),
    enabled: !!id && !!versaoId,
  });

  const { data: competencias } = useQuery({
    queryKey: ["competencias-abertas"],
    queryFn: () => api.get<{ items: Competencia[] }>("/competencias?status=ABERTA&porPagina=100").then((r) => r.items),
    enabled: publicarAberto,
  });

  const salvar = useMutation({
    mutationFn: (schema: SchemaFormulario) =>
      api.put<VersaoData>(`/formularios/${id}/versoes/${versaoId}`, { schema }),
    onSuccess: (resp) => {
      setErro(null);
      queryClient.invalidateQueries({ queryKey: ["formularios"] });
      // Se uma nova versão foi criada (formulário publicado com respostas), navega para ela.
      if (resp.id && resp.id !== versaoId) {
        navigate(`/formularios/${id}/versoes/${resp.id}/editar`, { replace: true });
      } else {
        queryClient.invalidateQueries({ queryKey: ["versao-editar", id, versaoId] });
      }
    },
    onError: (e) => setErro(e instanceof ApiError ? e.message : "Erro ao salvar o formulário."),
  });

  const publicar = useMutation({
    mutationFn: () =>
      api.patch(`/formularios/${id}/versoes/${versaoId}/publicar`, { competenciaId }),
    onSuccess: () => {
      setPublicarAberto(false);
      navigate(`/formularios/${id}`);
    },
    onError: (e) => setErro(e instanceof ApiError ? e.message : "Erro ao publicar."),
  });

  if (isLoading || !data) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/formularios/${id}`)} sx={{ mb: 2 }}>
        Voltar
      </Button>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5">{data.formulario.nome}</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Versão {data.versao}
            </Typography>
            <Chip
              label={data.status}
              size="small"
              color={data.status === "PUBLICADO" ? "success" : "default"}
            />
          </Stack>
        </Box>
        {data.status === "RASCUNHO" && (
          <Button
            variant="outlined"
            startIcon={<PublishIcon />}
            onClick={() => setPublicarAberto(true)}
          >
            Publicar
          </Button>
        )}
      </Stack>

      {data.status === "PUBLICADO" && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Esta versão está publicada. Ao salvar alterações, se já houver respostas, uma nova versão
          será criada automaticamente (as respostas da versão atual permanecem intactas).
        </Alert>
      )}

      <FormularioBuilder
        schemaInicial={data.schema}
        salvando={salvar.isPending}
        erro={erro}
        onSalvar={(schema) => salvar.mutate(schema)}
      />

      <Dialog open={publicarAberto} onClose={() => setPublicarAberto(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Publicar formulário</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Vincule a uma competência ABERTA. Após publicar, o formulário aceita submissões.
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Competência</InputLabel>
            <Select
              label="Competência"
              value={competenciaId}
              onChange={(e) => setCompetenciaId(e.target.value)}
            >
              {competencias?.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.nome}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPublicarAberto(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!competenciaId || publicar.isPending}
            onClick={() => publicar.mutate()}
          >
            {publicar.isPending ? <CircularProgress size={20} color="inherit" /> : "Publicar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
