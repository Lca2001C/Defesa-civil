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
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SendIcon from "@mui/icons-material/Send";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import EditIcon from "@mui/icons-material/Edit";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import type { SchemaFormulario } from "@dcmg/contracts";

interface Revisao {
  id: string;
  acao: string;
  comentario: string | null;
  criadoEm: string;
  revisor: { nome: string };
}

interface SubmissaoCompleta {
  id: string;
  protocolo: string;
  status: string;
  nomeRespondente: string;
  cpfRespondente: string;
  cargoRespondente: string | null;
  emailRespondente: string | null;
  criadoEm: string;
  enviadoEm: string | null;
  validadoEm: string | null;
  dados: Record<string, unknown>;
  municipio: { nome: string; uf: { sigla: string } };
  formularioVersao: { versao: number; schema: SchemaFormulario; formulario: { nome: string } };
  competencia: { nome: string; status: string };
  autor: { nome: string; email: string };
  revisoes: Revisao[];
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

const ICONE_ACAO: Record<string, string> = {
  SOLICITOU_CORRECAO: "⚠️",
  REVISOU: "✏️",
  VALIDOU: "✅",
  REJEITOU: "❌",
};

export default function SubmissaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { usuario } = useAuth();
  const [dialogAcao, setDialogAcao] = useState<string | null>(null);
  const [comentario, setComentario] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["submissao", id],
    queryFn: () => api.get<SubmissaoCompleta>(`/submissoes/${id}`),
    enabled: !!id,
  });

  const podeRevisar = usuario?.permissoes.includes("submissoes.revisar") ?? false;
  const podeValidar = usuario?.permissoes.includes("submissoes.validar") ?? false;
  const podeCriar = usuario?.permissoes.includes("submissoes.criar") ?? false;

  const acaoMutation = useMutation({
    mutationFn: (acao: string) =>
      api.patch(`/submissoes/${id}/${acao}`, { comentario: comentario || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["submissao", id] });
      qc.invalidateQueries({ queryKey: ["submissoes"] });
      setDialogAcao(null);
      setComentario("");
      setErro(null);
    },
    onError: (e: unknown) => setErro((e as Error).message),
  });

  const enviarMutation = useMutation({
    mutationFn: () => api.patch(`/submissoes/${id}/enviar`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["submissao", id] });
      qc.invalidateQueries({ queryKey: ["submissoes"] });
    },
    onError: (e: unknown) => setErro((e as Error).message),
  });

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!data) return null;

  const botoes = [
    data.status === "RASCUNHO" && podeCriar && {
      label: "Enviar resposta",
      icon: <SendIcon />,
      color: "contained" as const,
      acao: () => enviarMutation.mutate(),
    },
    (data.status === "ENVIADA" || data.status === "EM_ANALISE" || data.status === "REVISADA") &&
      podeRevisar && {
        label: "Solicitar correção",
        icon: <EditIcon />,
        color: "outlined" as const,
        acao: () => setDialogAcao("solicitar-correcao"),
      },
    data.status === "CORRECAO_SOLICITADA" &&
      podeCriar && {
        label: "Reenviar",
        icon: <SendIcon />,
        color: "outlined" as const,
        acao: () => setDialogAcao("revisar"),
      },
    (data.status === "ENVIADA" || data.status === "REVISADA") &&
      podeValidar && {
        label: "Validar",
        icon: <CheckCircleIcon />,
        color: "contained" as const,
        acao: () => setDialogAcao("validar"),
      },
    data.status !== "VALIDADA" &&
      data.status !== "RASCUNHO" &&
      podeValidar && {
        label: "Rejeitar",
        icon: <CancelIcon />,
        color: "outlined" as const,
        acao: () => setDialogAcao("rejeitar"),
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

      {/* Cabeçalho */}
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3, flexWrap: "wrap", gap: 1 }}>
        <Box>
          <Typography variant="h5">
            {data.formularioVersao.formulario.nome}{" "}
            <Typography component="span" variant="caption" color="text.secondary">
              v{data.formularioVersao.versao}
            </Typography>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {data.municipio.nome} – {data.municipio.uf.sigla} · Competência:{" "}
            {data.competencia.nome}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Protocolo: <strong>{data.protocolo}</strong>
            {data.enviadoEm &&
              ` · Enviado em ${new Date(data.enviadoEm).toLocaleDateString("pt-BR")}`}
          </Typography>
        </Box>
        <Chip label={data.status} color={COR_STATUS[data.status] ?? "default"} />
      </Box>

      {/* Ações */}
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
        {/* Dados do respondente */}
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

        {/* Dados preenchidos */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Respostas
            </Typography>
            <Divider sx={{ mb: 1.5 }} />
            {Object.entries(data.dados).map(([k, v]) => (
              <Box key={k} sx={{ display: "flex", gap: 1, mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
                  {k}
                </Typography>
                <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                  {String(v ?? "—")}
                </Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      </Box>

      {/* Histórico de revisões */}
      {data.revisoes.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Histórico de revisões
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {data.revisoes.map((r) => (
                <Box
                  key={r.id}
                  sx={{
                    display: "flex",
                    gap: 1.5,
                    pl: 1,
                    borderLeft: "3px solid",
                    borderColor: "primary.main",
                  }}
                >
                  <Box>
                    <Typography variant="subtitle2">
                      {ICONE_ACAO[r.acao] ?? "•"} {r.acao.replace(/_/g, " ")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {r.revisor.nome} · {new Date(r.criadoEm).toLocaleString("pt-BR")}
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

      {/* Dialog de confirmação de ação */}
      <Dialog open={!!dialogAcao} onClose={() => setDialogAcao(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogAcao === "solicitar-correcao" && "Solicitar correção"}
          {dialogAcao === "revisar" && "Reenviar resposta corrigida"}
          {dialogAcao === "validar" && "Validar submissão"}
          {dialogAcao === "rejeitar" && "Rejeitar submissão"}
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
