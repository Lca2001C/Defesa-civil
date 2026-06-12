import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  IconButton,
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
import { api } from "../../lib/api";
import { DynamicForm } from "../../components/dynamic-form";
import type { SchemaFormulario } from "@dcmg/contracts";

// ── tipos ────────────────────────────────────────────────────────────────────

interface VersaoOpcao {
  id: string;
  versao: number;
  formulario: { id: string; nome: string };
  competencia: { id: string; nome: string } | null;
}

interface VersaoCompleta {
  id: string;
  versao: number;
  schema: SchemaFormulario;
  formulario: { nome: string };
}

interface ArquivoAnexado {
  id: string;
  nome: string;
  tamanhoKb?: number;
}

// ── constantes ────────────────────────────────────────────────────────────────

const PASSOS = ["Selecionar formulário", "Preencher resposta", "Confirmar e enviar"];

const ACCEPT_TIPOS =
  ".pdf,.docx,.doc,.xlsx,.xls,.zip,.png,.jpg,.jpeg,.kml,.kmz,.json,.geojson,.shp,.dbf,.shx,.prj";

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

  // ── queries ──────────────────────────────────────────────────────────────

  const { data: versoes, isLoading: carregandoVersoes } = useQuery({
    queryKey: ["versoes-publicadas"],
    queryFn: () => api.get<VersaoOpcao[]>("/formularios/versoes/publicadas"),
  });

  const versaoSelecionada = versoes?.find((v) => v.id === versaoId);

  const { data: versao } = useQuery({
    queryKey: ["versao", versaoId],
    queryFn: () =>
      versaoSelecionada
        ? api.get<VersaoCompleta>(
            `/formularios/${versaoSelecionada.formulario.id}/versoes/${versaoId}`,
          )
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
        const sub = await api.post<{ id: string; protocolo: string }>("/submissoes", {
          formularioVersaoId: versaoId,
          competenciaId: compId,
          municipioId: parseInt(municipioId, 10),
          dados: dadosForm,
          enviarImediatamente: false,
        });
        setSubmissaoId(sub.id);
      } else {
        await api.patch(`/submissoes/${submissaoId}`, { dados: dadosForm });
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
      const fd = new FormData();
      fd.append("arquivo", file);
      return api.post<{ id: string; arquivo: { nomeOriginal: string; tamanhoBytes: number | null } }>(
        `/submissoes/${submissaoId}/anexos`,
        fd,
      );
    },
    onSuccess: (r) => {
      setArquivos((prev) => [
        ...prev,
        {
          id: r.id,
          nome: r.arquivo.nomeOriginal,
          tamanhoKb: r.arquivo.tamanhoBytes
            ? Math.round(r.arquivo.tamanhoBytes / 1024)
            : undefined,
        },
      ]);
      setErro(null);
    },
    onError: (e: unknown) => setErro((e as Error).message),
  });

  const removerArquivoMutation = useMutation({
    mutationFn: (arquivoId: string) =>
      api.del(`/submissoes/${submissaoId}/anexos/${arquivoId}`),
    onSuccess: (_, arquivoId) =>
      setArquivos((prev) => prev.filter((a) => a.id !== arquivoId)),
    onError: (e: unknown) => setErro((e as Error).message),
  });

  // ── mutation de envio ─────────────────────────────────────────────────────

  const enviarMutation = useMutation({
    mutationFn: () => api.patch(`/submissoes/${submissaoId}/enviar`, {}),
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

      <Stepper activeStep={passo} sx={{ mb: 4 }}>
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

              <TextField
                label="Código IBGE do município"
                value={municipioId}
                onChange={(e) => setMunicipioId(e.target.value)}
                size="small"
                type="number"
                helperText="Ex.: 3106200 para Belo Horizonte"
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

              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                <Button variant="outlined" onClick={() => setPasso(1)}>
                  Revisar respostas
                </Button>
                <Button
                  variant="outlined"
                  disabled={enviarMutation.isPending}
                  onClick={() => navigate(`/submissoes/${submissaoId}`)}
                >
                  Salvar rascunho
                </Button>
                <Button
                  variant="contained"
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
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="h6">Anexos (opcional)</Typography>
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
