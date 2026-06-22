import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import SendIcon from "@mui/icons-material/Send";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EditIcon from "@mui/icons-material/Edit";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { uploadAnexo } from "../../lib/uploadR2";
import { useAuth } from "../../lib/auth-context";
import { ACCEPT_TIPOS } from "../../shared/constants";
import { SubmissoesService } from "./services/submissoes.service";

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

const ICONE_ACAO: Record<string, string> = {
  ENVIOU: "📨",
  SOLICITOU_CORRECAO: "⚠️",
  REVISOU: "✏️",
  APROVOU: "✅",
  EDITOU: "📝",
};

export default function SubmissaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { usuario } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dialogAcao, setDialogAcao] = useState<string | null>(null);
  const [comentario, setComentario] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [progressoUpload, setProgressoUpload] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["submissao", id],
    queryFn: () => SubmissoesService.buscar(id!),
    enabled: !!id,
  });

  const podeRevisar = usuario?.permissoes.includes("submissoes.revisar") ?? false;
  const podeValidar = usuario?.permissoes.includes("submissoes.validar") ?? false;
  const podeCriar = usuario?.permissoes.includes("submissoes.criar") ?? false;
  const podeEditar = usuario?.permissoes.includes("submissoes.editar") ?? false;

  const invalida = () => {
    qc.invalidateQueries({ queryKey: ["submissao", id] });
    qc.invalidateQueries({ queryKey: ["submissoes"] });
  };

  const acaoMutation = useMutation({
    mutationFn: (acao: string) => SubmissoesService.acao(id!, acao, comentario),
    onSuccess: () => {
      invalida();
      setDialogAcao(null);
      setComentario("");
      setErro(null);
    },
    onError: (e: unknown) => setErro((e as Error).message),
  });

  const enviarMutation = useMutation({
    mutationFn: () => SubmissoesService.enviar(id!),
    onSuccess: invalida,
    onError: (e: unknown) => setErro((e as Error).message),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      if (!id) throw new Error("ID da submissão não disponível.");
      return uploadAnexo(id, file, undefined, setProgressoUpload);
    },
    onSuccess: () => { invalida(); setErro(null); setProgressoUpload(null); },
    onError: (e: unknown) => { setErro((e as Error).message); setProgressoUpload(null); },
  });

  const removerAnexo = useMutation({
    mutationFn: (anexoId: string) => SubmissoesService.removerAnexo(id!, anexoId),
    onSuccess: invalida,
    onError: (e: unknown) => setErro((e as Error).message),
  });

  const [baixando, setBaixando] = useState<"pdf" | "xlsx" | null>(null);
  async function baixar(formato: "pdf" | "xlsx") {
    if (!id) return;
    setBaixando(formato);
    setErro(null);
    try {
      await SubmissoesService.baixarExport(id, formato);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao baixar a submissão.");
    } finally {
      setBaixando(null);
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!data) return null;

  const rotuloPorCodigo = new Map<string, string>();
  const secoesSchema = data.schema?.paginas?.length
    ? data.schema.paginas.flatMap((pg) => pg.secoes ?? [])
    : data.schema?.secoes ?? [];
  for (const s of secoesSchema) {
    for (const p of s.perguntas) rotuloPorCodigo.set(p.codigo, p.rotulo);
  }

  const botoes = [
    (data.status === "RASCUNHO" || data.status === "EM_PREENCHIMENTO") && podeCriar && {
      label: "Enviar resposta",
      icon: <SendIcon />,
      color: "contained" as const,
      acao: () => enviarMutation.mutate(),
    },
    (data.status === "ENVIADO" || data.status === "REVISADO") && podeRevisar && {
      label: "Solicitar correção",
      icon: <EditIcon />,
      color: "outlined" as const,
      acao: () => setDialogAcao("solicitar-correcao"),
    },
    data.status === "CORRECAO_SOLICITADA" && podeCriar && {
      label: "Reenviar",
      icon: <SendIcon />,
      color: "outlined" as const,
      acao: () => setDialogAcao("revisar"),
    },
    (data.status === "ENVIADO" || data.status === "REVISADO") && podeValidar && {
      label: "Aprovar",
      icon: <CheckCircleIcon />,
      color: "contained" as const,
      acao: () => setDialogAcao("aprovar"),
    },
  ].filter(Boolean) as {
    label: string;
    icon: React.ReactNode;
    color: "contained" | "outlined";
    acao: () => void;
  }[];

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} sx={{ mb: 2 }} onClick={() => navigate("/submissoes")}>
        Voltar
      </Button>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3, flexWrap: "wrap", gap: 1 }}>
        <Box>
          <Typography variant="h5">
            {data.formularioVersao.formulario.nome}{" "}
            <Typography component="span" variant="caption" color="text.secondary">
              v{data.formularioVersao.versao}
            </Typography>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {data.municipio.nome} – {data.municipio.uf.sigla} · Competência: {data.competencia.nome}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Protocolo: <strong>{data.protocolo}</strong>
            {data.enviadoEm && ` · Enviado em ${new Date(data.enviadoEm).toLocaleDateString("pt-BR")}`}
          </Typography>
        </Box>
        <Stack spacing={1} alignItems="flex-end">
          <Chip label={LABEL_STATUS[data.status] ?? data.status} color={COR_STATUS[data.status] ?? "default"} />
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={baixando === "xlsx" ? <CircularProgress size={14} /> : <DownloadIcon />}
              disabled={baixando !== null}
              onClick={() => baixar("xlsx")}
            >
              Excel
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={baixando === "pdf" ? <CircularProgress size={14} /> : <DownloadIcon />}
              disabled={baixando !== null}
              onClick={() => baixar("pdf")}
            >
              PDF
            </Button>
          </Stack>
        </Stack>
      </Box>

      {botoes.length > 0 && (
        <Box sx={{ display: "flex", gap: 1, mb: 3, flexWrap: "wrap" }}>
          {botoes.map((b) => (
            <Button key={b.label} variant={b.color} startIcon={b.icon} onClick={b.acao}>
              {b.label}
            </Button>
          ))}
        </Box>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: { md: "1fr 1fr" }, gap: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Respondente
            </Typography>
            <Divider sx={{ mb: 1.5 }} />
            {[
              ["Nome", data.nomeRespondente],
              ["CPF", data.cpfRespondente.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")],
              ["Cargo", data.cargoRespondente],
              ["E-mail", data.emailRespondente],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <Box key={k} sx={{ display: "flex", gap: 1, mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>
                    {k}
                  </Typography>
                  <Typography variant="body2">{v}</Typography>
                </Box>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Respostas
            </Typography>
            <Divider sx={{ mb: 1.5 }} />
            {Object.entries(data.dados).map(([k, v]) => (
              <Box key={k} sx={{ display: "flex", gap: 1, mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 140 }}>
                  {rotuloPorCodigo.get(k) ?? k}
                </Typography>
                <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                  {Array.isArray(v) ? v.join(", ") : String(v ?? "—")}
                </Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      </Box>

      {/* Anexos */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="h6">Anexos</Typography>
            {podeEditar && (
              <Button
                size="small"
                startIcon={<UploadFileIcon />}
                onClick={() => inputRef.current?.click()}
                disabled={uploadMutation.isPending}
              >
                {uploadMutation.isPending ? "Enviando…" : "Anexar arquivo"}
              </Button>
            )}
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
          </Box>
          <Typography variant="caption" color="text.secondary">
            Tipos aceitos: PDF, DOCX, XLSX, ZIP, PNG, JPG · Geoespaciais: KML, KMZ, SHP, GeoJSON.
          </Typography>
          {progressoUpload !== null && (
            <Box sx={{ mt: 1, mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Enviando… {progressoUpload}%
              </Typography>
              <LinearProgress variant="determinate" value={progressoUpload} sx={{ mt: 0.5 }} />
            </Box>
          )}
          <List dense>
            {data.anexos.map((a) => (
              <ListItem
                key={a.id}
                secondaryAction={
                  podeEditar && (
                    <IconButton edge="end" size="small" color="error" onClick={() => removerAnexo.mutate(a.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )
                }
              >
                <ListItemText
                  primary={a.arquivo.nomeOriginal}
                  secondary={a.arquivo.tamanhoBytes ? `${Math.round(a.arquivo.tamanhoBytes / 1024)} KB` : undefined}
                />
              </ListItem>
            ))}
            {data.anexos.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
                Nenhum anexo.
              </Typography>
            )}
          </List>
        </CardContent>
      </Card>

      {/* Histórico */}
      {data.historico.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Histórico
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {data.historico.map((r) => (
                <Box
                  key={r.id}
                  sx={{ display: "flex", gap: 1.5, pl: 1, borderLeft: "3px solid", borderColor: "primary.main" }}
                >
                  <Box>
                    <Typography variant="subtitle2">
                      {ICONE_ACAO[r.acao] ?? "•"} {r.acao.replace(/_/g, " ")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {r.autor.nome} · {new Date(r.criadoEm).toLocaleString("pt-BR")}
                    </Typography>
                    {r.comentario && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {r.comentario}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!dialogAcao} onClose={() => setDialogAcao(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogAcao === "solicitar-correcao" && "Solicitar correção"}
          {dialogAcao === "revisar" && "Reenviar resposta corrigida"}
          {dialogAcao === "aprovar" && "Aprovar submissão"}
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Comentário (opcional)"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            multiline
            rows={3}
            fullWidth
            size="small"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogAcao(null)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={acaoMutation.isPending}
            onClick={() => dialogAcao && acaoMutation.mutate(dialogAcao)}
          >
            {acaoMutation.isPending ? <CircularProgress size={20} color="inherit" /> : "Confirmar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
