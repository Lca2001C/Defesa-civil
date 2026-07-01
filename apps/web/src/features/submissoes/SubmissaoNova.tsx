import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteIcon from "@mui/icons-material/Delete";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadAnexo } from "../../lib/uploadAnexo";
import { DynamicForm } from "../../components/dynamic-form";
import type { ArquivoUploadado } from "../../components/dynamic-form/types";
import { ACCEPT_TIPOS } from "../../shared/constants";
import { SubmissoesService } from "./services/submissoes.service";
import { FormulariosService } from "../formularios/services/formularios.service";
import { MunicipiosService } from "../municipios/services/municipios.service";

// ── tipos ────────────────────────────────────────────────────────────────────

interface ArquivoAnexado {
  id: string;
  nome: string;
  tamanhoKb?: number;
}

// ── constantes ────────────────────────────────────────────────────────────────

const PASSOS = ["Selecionar formulário", "Preencher resposta", "Confirmar e enviar"];

// ── componente ────────────────────────────────────────────────────────────────

export default function SubmissaoNova() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [passo, setPasso] = useState(0);
  const [versaoId, setVersaoId] = useState("");
  const [municipioId, setMunicipioId] = useState("");
  const [dados, setDados] = useState<Record<string, unknown>>({});
  const [erro, setErro] = useState<string | null>(null);

  // Criado automaticamente ao avançar do passo 1 → 2
  const [submissaoId, setSubmissaoId] = useState<string | null>(null);
  const [arquivos, setArquivos] = useState<ArquivoAnexado[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [progressoUpload, setProgressoUpload] = useState<number | null>(null);

  // ── queries ──────────────────────────────────────────────────────────────

  const { data: versoes, isLoading: carregandoVersoes } = useQuery({
    queryKey: ["versoes-publicadas"],
    queryFn: () => FormulariosService.listarVersoesPublicadas(),
  });

  const { data: municipios = [], isLoading: carregandoMunicipios } = useQuery({
    queryKey: ["municipios-lista"],
    queryFn: () => MunicipiosService.listarParaSelecao(),
    staleTime: 60 * 60 * 1000, // 1h — lista praticamente estática
  });

  const versaoSelecionada = versoes?.find((v) => v.id === versaoId);

  const { data: versao } = useQuery({
    queryKey: ["versao", versaoId],
    queryFn: () =>
      versaoSelecionada
        ? FormulariosService.buscarVersao(versaoSelecionada.formulario.id, versaoId)
        : null,
    enabled: !!versaoId && !!versaoSelecionada,
  });

  // ── passo 1 → 2: salva rascunho automaticamente ──────────────────────────

  async function handlePreencherForm(dadosForm: Record<string, unknown>) {
    setDados(dadosForm);
    setErro(null);
    setSalvando(true);
    try {
      const compId = versaoSelecionada?.competencia?.id ?? "";
      if (!submissaoId) {
        const sub = await SubmissoesService.criar({
          formularioVersaoId: versaoId,
          competenciaId: compId,
          municipioId: parseInt(municipioId, 10),
          dados: dadosForm,
          enviarImediatamente: false,
        });
        setSubmissaoId(sub.id);
      } else {
        await SubmissoesService.atualizarDados(submissaoId, dadosForm);
      }
      setPasso(2);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  // ── mutations de anexo ────────────────────────────────────────────────────

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      if (!submissaoId) throw new Error("Submissão ainda não criada.");
      return uploadAnexo(submissaoId, file, undefined, setProgressoUpload);
    },
    onSuccess: (r) => {
      setArquivos((prev) => [...prev, r]);
      setErro(null);
      setProgressoUpload(null);
    },
    onError: (e: unknown) => {
      setErro((e as Error).message);
      setProgressoUpload(null);
    },
  });

  const removerArquivoMutation = useMutation({
    mutationFn: (arquivoId: string) =>
      SubmissoesService.removerAnexo(submissaoId!, arquivoId),
    onSuccess: (_, arquivoId) =>
      setArquivos((prev) => prev.filter((a) => a.id !== arquivoId)),
    onError: (e: unknown) => setErro((e as Error).message),
  });

  // ── upload inline em campos UPLOAD do formulário ─────────────────────────

  async function handleUploadInForm(file: File, perguntaCodigo: string): Promise<ArquivoUploadado> {
    // Cria o rascunho de forma lazy na primeira vez que o usuário sobe um arquivo
    let sid = submissaoId;
    if (!sid) {
      const compId = versaoSelecionada?.competencia?.id ?? "";
      const sub = await SubmissoesService.criar({
        formularioVersaoId: versaoId,
        competenciaId: compId,
        municipioId: parseInt(municipioId, 10),
        dados: {},
        enviarImediatamente: false,
      });
      sid = sub.id;
      setSubmissaoId(sid);
    }

    const resultado = await uploadAnexo(sid, file, perguntaCodigo, setProgressoUpload);
    setProgressoUpload(null);

    // Registra no estado de anexos para exibição no passo de confirmação
    setArquivos((prev) => {
      const jaExiste = prev.some((a) => a.id === resultado.id);
      return jaExiste ? prev : [...prev, resultado];
    });

    return resultado;
  }

  // ── mutation de envio ─────────────────────────────────────────────────────

  const enviarMutation = useMutation({
    mutationFn: () => SubmissoesService.enviar(submissaoId!),
    onSuccess: () => navigate(`/submissoes/${submissaoId}`),
    onError: (e: unknown) => setErro((e as Error).message),
  });

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} sx={{ mb: 2 }} onClick={() => navigate("/submissoes")}>
        Voltar
      </Button>

      <Typography variant="h5" sx={{ mb: 3 }}>
        Nova resposta
      </Typography>

      <Stepper
        activeStep={passo}
        alternativeLabel
        sx={{ mb: 4, "& .MuiStepLabel-label": { typography: { xs: "caption", sm: "body2" } } }}
      >
        {PASSOS.map((l) => (
          <Step key={l}>
            <StepLabel>{l}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      {/* Passo 0 — Selecionar formulário */}
      {passo === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Selecionar formulário e município
            </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
              <TextField
                select
                label="Formulário / Versão"
                value={versaoId}
                onChange={(e) => setVersaoId(e.target.value)}
                SelectProps={{ native: true }}
                size="small"
                disabled={carregandoVersoes}
              >
                <option value="">— selecione —</option>
                {versoes?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.formulario.nome} v{v.versao}
                    {v.competencia ? ` · ${v.competencia.nome}` : ""}
                  </option>
                ))}
              </TextField>

              <Autocomplete
                options={municipios}
                loading={carregandoMunicipios}
                getOptionLabel={(o) => `${o.nome} (${o.id})`}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                value={municipios.find((m) => String(m.id) === municipioId) ?? null}
                onChange={(_, opcao) => setMunicipioId(opcao ? String(opcao.id) : "")}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Município"
                    size="small"
                    helperText="Digite o nome ou o código IBGE para buscar"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {carregandoMunicipios ? <CircularProgress size={18} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />

              <Button
                variant="contained"
                disabled={!versaoId || !municipioId}
                onClick={() => setPasso(1)}
              >
                Avançar
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Passo 1 — Preencher formulário dinâmico */}
      {passo === 1 && !versao && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {passo === 1 && versao?.schema && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {versaoSelecionada?.formulario.nome}
            </Typography>
            <DynamicForm
              schema={versao.schema}
              defaultValues={dados}
              carregando={salvando}
              onSubmit={handlePreencherForm}
              onUpload={handleUploadInForm}
            />
          </CardContent>
        </Card>
      )}

      {/* Passo 2 — Confirmar, anexar e enviar */}
      {passo === 2 && submissaoId && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Resumo */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Confirmar envio
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Formulário: <strong>{versaoSelecionada?.formulario.nome}</strong>
                <br />
                Município (IBGE): <strong>{municipioId}</strong>
                <br />
                Campos preenchidos: <strong>{Object.keys(dados).length}</strong>
              </Typography>

              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "column", sm: "row" },
                  gap: 1,
                  flexWrap: "wrap",
                }}
              >
                <Button
                  variant="outlined"
                  sx={{ width: { xs: "100%", sm: "auto" } }}
                  onClick={() => setPasso(1)}
                >
                  Revisar respostas
                </Button>
                <Button
                  variant="outlined"
                  sx={{ width: { xs: "100%", sm: "auto" } }}
                  disabled={enviarMutation.isPending}
                  onClick={() => navigate(`/submissoes/${submissaoId}`)}
                >
                  Salvar rascunho
                </Button>
                <Button
                  variant="contained"
                  sx={{ width: { xs: "100%", sm: "auto" } }}
                  disabled={enviarMutation.isPending}
                  onClick={() => enviarMutation.mutate()}
                >
                  {enviarMutation.isPending ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    "Enviar resposta"
                  )}
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* Anexos */}
          <Card>
            <CardContent>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 1,
                  mb: 1,
                }}
              >
                <Typography variant="h6" sx={{ minWidth: 0 }}>
                  Anexos (opcional)
                </Typography>
                <Button
                  size="small"
                  startIcon={<UploadFileIcon />}
                  onClick={() => inputRef.current?.click()}
                  disabled={uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? "Enviando…" : "Anexar arquivo"}
                </Button>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Tipos aceitos: PDF, DOCX, XLSX, ZIP, PNG, JPG · Geoespaciais: KML, KMZ, SHP, GeoJSON.
              </Typography>

              <input
                ref={inputRef}
                type="file"
                hidden
                accept={ACCEPT_TIPOS}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadMutation.mutate(f);
                  e.target.value = "";
                }}
              />

              <Divider sx={{ my: 1.5 }} />

              {progressoUpload !== null && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Enviando… {progressoUpload}%
                  </Typography>
                  <LinearProgress variant="determinate" value={progressoUpload} sx={{ mt: 0.5 }} />
                </Box>
              )}

              {arquivos.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhum arquivo anexado.
                </Typography>
              ) : (
                <List dense disablePadding>
                  {arquivos.map((a) => (
                    <ListItem
                      key={a.id}
                      disableGutters
                      secondaryAction={
                        <IconButton
                          edge="end"
                          size="small"
                          color="error"
                          onClick={() => removerArquivoMutation.mutate(a.id)}
                          disabled={removerArquivoMutation.isPending}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      }
                    >
                      <ListItemText
                        primary={a.nome}
                        secondary={a.tamanhoKb ? `${a.tamanhoKb} KB` : undefined}
                        sx={{ pr: 5, wordBreak: "break-word" }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
}
