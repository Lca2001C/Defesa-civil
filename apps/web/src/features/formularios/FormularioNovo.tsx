import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import { ApiError } from "../../lib/api";
import { FormulariosService } from "./services/formularios.service";
import type { CriacaoResp } from "./types";

const CATEGORIAS = [
  "Diagnóstico",
  "Levantamento de Risco",
  "Monitoramento",
  "Relatório de Ocorrência",
  "Outros",
];

export default function FormularioNovo() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<"escolha" | "branco">("escolha");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [erro, setErro] = useState<string | null>(null);

  const { data: templates } = useQuery({
    queryKey: ["templates"],
    queryFn: () => FormulariosService.listarTemplates(),
  });

  function irParaEditor(resp: CriacaoResp) {
    navigate(`/formularios/${resp.id}/versoes/${resp.versaoInicialId}/editar`);
  }

  const criarBranco = useMutation({
    mutationFn: () => FormulariosService.criar({ nome, descricao, categoria }),
    onSuccess: irParaEditor,
    onError: (e) => setErro(e instanceof ApiError ? e.message : "Erro ao criar o formulário."),
  });

  const criarDeTemplate = useMutation({
    mutationFn: (templateId: string) => FormulariosService.criarDeTemplate(templateId),
    onSuccess: irParaEditor,
    onError: (e) => setErro(e instanceof ApiError ? e.message : "Erro ao criar a partir do template."),
  });

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/formularios")} sx={{ mb: 2 }}>
        Voltar
      </Button>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Novo formulário
      </Typography>

      {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}

      {modo === "escolha" && (
        <Stack spacing={3}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Card sx={{ flex: 1 }}>
              <CardActionArea onClick={() => setModo("branco")} sx={{ p: 2, height: "100%" }}>
                <CardContent>
                  <NoteAddIcon sx={{ fontSize: 40, color: "primary.main", mb: 1 }} />
                  <Typography variant="h6">Criar em branco</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Monte o formulário do zero no construtor visual.
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <LibraryBooksIcon sx={{ fontSize: 40, color: "primary.main", mb: 1 }} />
                <Typography variant="h6">A partir de um template</Typography>
                <Typography variant="body2" color="text.secondary">
                  Comece de um modelo pronto e ajuste no construtor.
                </Typography>
              </CardContent>
            </Card>
          </Stack>

          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Templates disponíveis
            </Typography>
            <Stack spacing={1}>
              {templates?.map((t) => (
                <Card key={t.id} variant="outlined">
                  <CardActionArea
                    onClick={() => criarDeTemplate.mutate(t.id)}
                    disabled={criarDeTemplate.isPending}
                  >
                    <CardContent sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2">{t.nome}</Typography>
                        {t.descricao && (
                          <Typography variant="body2" color="text.secondary">
                            {t.descricao}
                          </Typography>
                        )}
                      </Box>
                      {criarDeTemplate.isPending && <CircularProgress size={18} />}
                    </CardContent>
                  </CardActionArea>
                </Card>
              ))}
              {templates?.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Nenhum template cadastrado.
                </Typography>
              )}
            </Stack>
          </Box>
        </Stack>
      )}

      {modo === "branco" && (
        <Card sx={{ width: "100%", maxWidth: 560 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Dados do formulário
            </Typography>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} fullWidth size="small" required />
              <TextField
                label="Descrição"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                fullWidth
                size="small"
                multiline
                minRows={2}
              />
              <FormControl fullWidth size="small">
                <InputLabel>Categoria</InputLabel>
                <Select label="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                  {CATEGORIAS.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Divider />
              <Stack
                direction={{ xs: "column-reverse", sm: "row" }}
                spacing={1}
                sx={{ "& > .MuiButton-root": { width: { xs: "100%", sm: "auto" } } }}
              >
                <Button onClick={() => setModo("escolha")} variant="outlined">
                  Voltar
                </Button>
                <Button
                  variant="contained"
                  disabled={!nome || criarBranco.isPending}
                  onClick={() => criarBranco.mutate()}
                  startIcon={criarBranco.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
                >
                  Criar e abrir construtor
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
