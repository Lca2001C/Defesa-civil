import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { api, ApiError } from "../../lib/api";
import type { SchemaFormulario, SecaoFormulario } from "@dcmg/contracts";

const PASSOS = ["Upload do Template", "Revisar e Configurar", "Confirmar"];

const CATEGORIAS = [
  "Avaliação de Danos",
  "Levantamento de Risco",
  "Monitoramento",
  "Relatório de Ocorrência",
  "Outros",
];

export default function FormularioNovo() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [passo, setPasso] = useState(0);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [schema, setSchema] = useState<SchemaFormulario | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [erro, setErro] = useState<string | null>(null);

  // Step 0 → parse do template Excel
  const parseMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("arquivo", file);
      return api.post<SchemaFormulario>("/excel/parse-template", fd);
    },
    onSuccess: (data) => {
      setSchema(data);
      setErro(null);
      setPasso(1);
    },
    onError: (e) => {
      setErro(e instanceof ApiError ? e.message : "Erro ao processar a planilha.");
    },
  });

  // Step 2 → criar formulário
  const criarMutation = useMutation({
    mutationFn: () =>
      api.post<{ id: string }>("/formularios", { nome, descricao, categoria, schema }),
    onSuccess: (data) => {
      setPasso(2);
      setTimeout(() => navigate(`/formularios/${data.id}`), 1800);
    },
    onError: (e) => {
      setErro(e instanceof ApiError ? e.message : "Erro ao criar o formulário.");
    },
  });

  function handleArquivo(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (
      !file.name.endsWith(".xlsx") &&
      !file.name.endsWith(".xls")
    ) {
      setErro("Selecione um arquivo .xlsx ou .xls.");
      return;
    }
    setErro(null);
    setArquivo(file);
    parseMutation.mutate(file);
  }

  const camposTotais = schema
    ? (schema.secoes as SecaoFormulario[]).reduce(
        (acc, s) => acc + (s.campos?.length ?? 0),
        0,
      )
    : 0;

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/formularios")}
          variant="text"
        >
          Formulários
        </Button>
        <Typography variant="h5">Novo Formulário</Typography>
      </Stack>

      <Stepper activeStep={passo} sx={{ maxWidth: 600 }}>
        {PASSOS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {erro && <Alert severity="error">{erro}</Alert>}

      {/* ── Passo 0: Upload ── */}
      {passo === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Faça upload da planilha template
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              A estrutura do formulário (campos, seções, tipos de dados) será detectada
              automaticamente a partir dos cabeçalhos e da aba de definição da planilha.
            </Typography>

            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: "none" }}
              onChange={(e) => handleArquivo(e.target.files)}
            />

            <Box
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleArquivo(e.dataTransfer.files);
              }}
              sx={{
                border: "2px dashed",
                borderColor: "divider",
                borderRadius: 2,
                p: 6,
                textAlign: "center",
                cursor: "pointer",
                "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
              }}
            >
              {parseMutation.isPending ? (
                <Stack alignItems="center" spacing={1}>
                  <CircularProgress size={36} />
                  <Typography variant="body2" color="text.secondary">
                    Processando planilha...
                  </Typography>
                </Stack>
              ) : (
                <Stack alignItems="center" spacing={1}>
                  <UploadFileIcon sx={{ fontSize: 48, color: "text.secondary" }} />
                  <Typography variant="body1">
                    {arquivo ? arquivo.name : "Arraste ou clique para selecionar"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Aceita .xlsx e .xls
                  </Typography>
                </Stack>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* ── Passo 1: Revisar + Configurar ── */}
      {passo === 1 && schema && (
        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Schema detectado — {schema.secoes.length} seção
                {schema.secoes.length !== 1 ? "ões" : ""} · {camposTotais} campo
                {camposTotais !== 1 ? "s" : ""}
              </Typography>
              <Stack spacing={1}>
                {(schema.secoes as SecaoFormulario[]).map((secao, i) => (
                  <Box key={i}>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      {secao.titulo}
                    </Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {secao.campos?.map((campo, cIdx) => (
                        <Chip
                          key={`${i}_${cIdx}_${campo.chave}`}
                          label={`${campo.rotulo} (${campo.tipo})`}
                          size="small"
                          variant={campo.obrigatorio ? "filled" : "outlined"}
                          color={campo.obrigatorio ? "primary" : "default"}
                        />
                      ))}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Configurar o Formulário
              </Typography>
              <Stack spacing={2} sx={{ maxWidth: 480 }}>
                <TextField
                  label="Nome do formulário"
                  fullWidth
                  size="small"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Levantamento de Danos — 2026"
                />
                <TextField
                  label="Descrição"
                  fullWidth
                  size="small"
                  multiline
                  rows={2}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
                <FormControl fullWidth size="small">
                  <InputLabel>Categoria</InputLabel>
                  <Select
                    label="Categoria"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                  >
                    {CATEGORIAS.map((c) => (
                      <MenuItem key={c} value={c}>
                        {c}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </CardContent>
          </Card>

          <Stack direction="row" spacing={2}>
            <Button onClick={() => setPasso(0)} variant="outlined">
              Voltar
            </Button>
            <Button
              variant="contained"
              disabled={!nome || criarMutation.isPending}
              onClick={() => criarMutation.mutate()}
              startIcon={
                criarMutation.isPending ? (
                  <CircularProgress size={16} color="inherit" />
                ) : undefined
              }
            >
              Criar Formulário
            </Button>
          </Stack>
        </Stack>
      )}

      {/* ── Passo 2: Sucesso ── */}
      {passo === 2 && (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <CheckCircleIcon sx={{ fontSize: 56, color: "success.main", mb: 2 }} />
            <Typography variant="h6">Formulário criado com sucesso!</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Redirecionando para a página do formulário...
            </Typography>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
