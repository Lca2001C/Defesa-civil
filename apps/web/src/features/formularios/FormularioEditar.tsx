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
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PublishIcon from "@mui/icons-material/Publish";
import type { SchemaFormulario } from "@dcmg/contracts";
import { ApiError } from "../../lib/api";
import { FormularioBuilder } from "./builder/FormularioBuilder";
import { FormulariosService } from "./services/formularios.service";
import { CompetenciasService } from "../competencias/services/competencias.service";

export default function FormularioEditar() {
  const { id, versaoId } = useParams<{ id: string; versaoId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [erro, setErro] = useState<string | null>(null);
  const [publicarAberto, setPublicarAberto] = useState(false);
  const [competenciaId, setCompetenciaId] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["versao-editar", id, versaoId],
    queryFn: () => FormulariosService.buscarVersao(id!, versaoId!),
    enabled: !!id && !!versaoId,
  });

  const { data: competencias } = useQuery({
    queryKey: ["competencias-abertas"],
    queryFn: () => CompetenciasService.listarAbertas(),
    enabled: publicarAberto,
  });

  const salvar = useMutation({
    mutationFn: (schema: SchemaFormulario) =>
      FormulariosService.salvarVersao(id!, versaoId!, schema),
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
    mutationFn: () => FormulariosService.publicarVersao(id!, versaoId!, competenciaId),
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

      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        gap={1}
        sx={{ mb: 2 }}
      >
        <Box sx={{ minWidth: 0 }}>
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

      <Dialog
        open={publicarAberto}
        onClose={() => setPublicarAberto(false)}
        fullScreen={isMobile}
        maxWidth="xs"
        fullWidth
      >
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
