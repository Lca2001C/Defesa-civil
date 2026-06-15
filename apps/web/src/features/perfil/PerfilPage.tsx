import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Avatar,
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
  Grid,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import LockIcon from "@mui/icons-material/Lock";
import BadgeIcon from "@mui/icons-material/Badge";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import WorkIcon from "@mui/icons-material/Work";
import LocationCityIcon from "@mui/icons-material/LocationCity";
import ShieldIcon from "@mui/icons-material/Shield";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import AssignmentIcon from "@mui/icons-material/Assignment";
import { api, ApiError } from "../../lib/api";
import { cores } from "../../theme/tokens";

interface PerfilData {
  id: string;
  nome: string;
  email: string;
  cpf: string;
  cargo: string | null;
  telefone: string | null;
  escopo: string;
  ativo: boolean;
  ultimoAcessoEm: string | null;
  criadoEm: string;
  perfil: { nome: string; codigo: string; nivel: number };
  municipio: { id: number; nome: string } | null;
  regional: { nome: string } | null;
  uf: { sigla: string } | null;
  _count: { submissoes: number };
}

function dataFormatada(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function iniciais(nome: string): string {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function nivelLabel(nivel: number): { label: string; color: string } {
  if (nivel >= 100) return { label: "Super Admin", color: "#a855f7" };
  if (nivel >= 80) return { label: "Gestor Estadual", color: "#f97316" };
  if (nivel >= 70) return { label: "Analista Estadual", color: "#60a5fa" };
  if (nivel >= 60) return { label: "Coordenador Regional", color: "#22d3ee" };
  if (nivel >= 50) return { label: "Admin Municipal", color: "#22c55e" };
  if (nivel >= 25) return { label: "Coord. COMPDEC", color: "#eab308" };
  if (nivel >= 20) return { label: "Operador Municipal", color: "#94a3b8" };
  return { label: "Consulta", color: "#64748b" };
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ py: 1 }}>
      <Box sx={{ color: cores.laranjaPrimario, mt: 0.3 }}>{icon}</Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          {label}
        </Typography>
        <Typography variant="body2" component="div" sx={{ fontWeight: 500, mt: 0.2 }}>
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}

export default function PerfilPage() {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [senhaOpen, setSenhaOpen] = useState(false);

  const { data: perfil, isLoading } = useQuery<PerfilData>({
    queryKey: ["perfil", "me"],
    queryFn: () => api.get<PerfilData>("/usuarios/me"),
  });

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!perfil) return null;

  const { label: nivelStr, color: nivelColor } = nivelLabel(perfil.perfil.nivel);

  return (
    <Stack spacing={3}>
      <Typography variant="h5">Meu Perfil</Typography>

      {/* cabeçalho com avatar */}
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems="center">
            <Avatar
              sx={{
                width: 80,
                height: 80,
                bgcolor: cores.laranjaPrimario,
                fontSize: 28,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {iniciais(perfil.nome)}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {perfil.nome}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {perfil.email}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 0.5 }}>
                <Chip
                  label={perfil.perfil.nome}
                  size="small"
                  sx={{ bgcolor: nivelColor + "22", color: nivelColor, fontWeight: 600 }}
                />
                <Chip
                  label={perfil.ativo ? "Conta ativa" : "Conta inativa"}
                  size="small"
                  color={perfil.ativo ? "success" : "error"}
                />
                <Chip
                  label={`Nível ${perfil.perfil.nivel} — ${nivelStr}`}
                  size="small"
                  variant="outlined"
                  sx={{ opacity: 0.7 }}
                />
              </Stack>
            </Box>
            <Stack spacing={1} direction={{ xs: "row", sm: "column" }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<EditIcon />}
                onClick={() => setEditOpen(true)}
              >
                Editar
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="warning"
                startIcon={<LockIcon />}
                onClick={() => setSenhaOpen(true)}
              >
                Alterar senha
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        {/* dados pessoais */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ mb: 1, color: cores.laranjaPrimario, fontWeight: 700 }}>
                DADOS PESSOAIS
              </Typography>
              <Divider sx={{ mb: 1 }} />
              <InfoRow icon={<BadgeIcon fontSize="small" />} label="CPF" value={perfil.cpf} />
              <Divider sx={{ opacity: 0.15 }} />
              <InfoRow icon={<EmailIcon fontSize="small" />} label="E-mail" value={perfil.email} />
              <Divider sx={{ opacity: 0.15 }} />
              <InfoRow
                icon={<PhoneIcon fontSize="small" />}
                label="Telefone"
                value={perfil.telefone ?? <em style={{ opacity: 0.5 }}>Não informado</em>}
              />
              <Divider sx={{ opacity: 0.15 }} />
              <InfoRow
                icon={<WorkIcon fontSize="small" />}
                label="Cargo / Função"
                value={perfil.cargo ?? <em style={{ opacity: 0.5 }}>Não informado</em>}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* acesso e vínculo */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ mb: 1, color: cores.laranjaPrimario, fontWeight: 700 }}>
                ACESSO E VÍNCULO
              </Typography>
              <Divider sx={{ mb: 1 }} />
              <InfoRow
                icon={<ShieldIcon fontSize="small" />}
                label="Perfil de acesso"
                value={
                  <Tooltip title={`Código: ${perfil.perfil.codigo} • Nível: ${perfil.perfil.nivel}`}>
                    <span>{perfil.perfil.nome}</span>
                  </Tooltip>
                }
              />
              <Divider sx={{ opacity: 0.15 }} />
              <InfoRow
                icon={<LocationCityIcon fontSize="small" />}
                label="Escopo"
                value={perfil.escopo}
              />
              {perfil.municipio && (
                <>
                  <Divider sx={{ opacity: 0.15 }} />
                  <InfoRow
                    icon={<LocationCityIcon fontSize="small" />}
                    label="Município"
                    value={`${perfil.municipio.nome} (IBGE ${perfil.municipio.id})`}
                  />
                </>
              )}
              {perfil.regional && (
                <>
                  <Divider sx={{ opacity: 0.15 }} />
                  <InfoRow
                    icon={<LocationCityIcon fontSize="small" />}
                    label="Regional (REDEC)"
                    value={perfil.regional.nome}
                  />
                </>
              )}
              {perfil.uf && (
                <>
                  <Divider sx={{ opacity: 0.15 }} />
                  <InfoRow
                    icon={<LocationCityIcon fontSize="small" />}
                    label="UF"
                    value={perfil.uf.sigla}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* atividade */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" sx={{ mb: 1, color: cores.laranjaPrimario, fontWeight: 700 }}>
                ATIVIDADE
              </Typography>
              <Divider sx={{ mb: 1 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <InfoRow
                    icon={<CalendarTodayIcon fontSize="small" />}
                    label="Conta criada em"
                    value={dataFormatada(perfil.criadoEm)}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <InfoRow
                    icon={<AccessTimeIcon fontSize="small" />}
                    label="Último acesso"
                    value={dataFormatada(perfil.ultimoAcessoEm)}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <InfoRow
                    icon={<AssignmentIcon fontSize="small" />}
                    label="Submissões enviadas"
                    value={
                      <Typography variant="h6" sx={{ fontWeight: 700, color: cores.laranjaPrimario }}>
                        {perfil._count.submissoes}
                      </Typography>
                    }
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* modal editar dados */}
      <EditarDadosDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        perfil={perfil}
        onSuccess={() => void qc.invalidateQueries({ queryKey: ["perfil", "me"] })}
      />

      {/* modal alterar senha */}
      <AlterarSenhaDialog
        open={senhaOpen}
        onClose={() => setSenhaOpen(false)}
        usuarioId={perfil.id}
      />
    </Stack>
  );
}

// ── dialog: editar dados pessoais ─────────────────────────────────────────────

function EditarDadosDialog({
  open,
  onClose,
  perfil,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  perfil: PerfilData;
  onSuccess: () => void;
}) {
  const [nome, setNome] = useState(perfil.nome);
  const [cargo, setCargo] = useState(perfil.cargo ?? "");
  const [telefone, setTelefone] = useState(perfil.telefone ?? "");
  const [erro, setErro] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.patch("/usuarios/me", { nome, cargo, telefone }),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (e) => setErro(e instanceof ApiError ? e.message : "Erro ao salvar."),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Editar dados pessoais</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {erro && <Alert severity="error">{erro}</Alert>}
          <TextField
            label="Nome completo"
            fullWidth
            size="small"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
          <TextField
            label="Cargo / Função"
            fullWidth
            size="small"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
          />
          <TextField
            label="Telefone"
            fullWidth
            size="small"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(31) 99999-0000"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          disabled={mutation.isPending || !nome.trim()}
          onClick={() => mutation.mutate()}
          startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── dialog: alterar senha ─────────────────────────────────────────────────────

function AlterarSenhaDialog({
  open,
  onClose,
  usuarioId,
}: {
  open: boolean;
  onClose: () => void;
  usuarioId: string;
}) {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  function handleClose() {
    setNovaSenha("");
    setConfirmar("");
    setErro(null);
    setSucesso(false);
    onClose();
  }

  const mutation = useMutation({
    mutationFn: () => {
      if (novaSenha !== confirmar) throw new Error("As senhas não conferem.");
      if (novaSenha.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
      return api.patch(`/usuarios/${usuarioId}/senha`, { novaSenha });
    },
    onSuccess: () => setSucesso(true),
    onError: (e) => setErro(e instanceof Error ? e.message : "Erro ao alterar senha."),
  });

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Alterar senha</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {erro && <Alert severity="error">{erro}</Alert>}
          {sucesso ? (
            <Alert severity="success">Senha alterada com sucesso!</Alert>
          ) : (
            <>
              <TextField
                label="Nova senha"
                type="password"
                fullWidth
                size="small"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                helperText="Mínimo 8 caracteres"
              />
              <TextField
                label="Confirmar nova senha"
                type="password"
                fullWidth
                size="small"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>
          {sucesso ? "Fechar" : "Cancelar"}
        </Button>
        {!sucesso && (
          <Button
            variant="contained"
            color="warning"
            disabled={mutation.isPending || !novaSenha || !confirmar}
            onClick={() => { setErro(null); mutation.mutate(); }}
            startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            Alterar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
