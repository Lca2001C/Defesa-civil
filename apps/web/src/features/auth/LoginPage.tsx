import { useState, useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  FormHelperText,
  IconButton,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../lib/auth-context";
import { api, ApiError } from "../../lib/api";
import { cores } from "../../theme/tokens";

interface TokensResposta {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface TermoLgpd {
  versao: string;
  conteudo: string;
}

// ── Aba Entrar ────────────────────────────────────────────────────────────────

function AbaEntrar() {
  const { salvarTokens } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destino = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/";

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const resp = await api.post<TokensResposta>("/auth/login", { email, senha });
      salvarTokens(resp.accessToken, resp.refreshToken);
      navigate(destino, { replace: true });
    } catch (err) {
      setErro(
        err instanceof ApiError ? err.message : "Erro ao tentar fazer login. Tente novamente.",
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}

      <TextField
        label="E-mail"
        type="email"
        fullWidth
        size="small"
        sx={{ mb: 2 }}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        autoFocus
      />
      <TextField
        label="Senha"
        type="password"
        fullWidth
        size="small"
        sx={{ mb: 1 }}
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        required
        autoComplete="current-password"
      />

      <Box sx={{ mb: 3, textAlign: "right" }}>
        <Typography
          component={Link}
          to="/recuperar-senha"
          variant="caption"
          sx={{ color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
        >
          Esqueci minha senha
        </Typography>
      </Box>

      <Button type="submit" variant="contained" fullWidth disabled={carregando} size="large">
        {carregando ? <CircularProgress size={22} color="inherit" /> : "Entrar"}
      </Button>
    </Box>
  );
}

// ── Aba Criar Conta ───────────────────────────────────────────────────────────

function AbaCriarConta() {
  const { salvarTokens } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nome: "", cpf: "", email: "", senha: "", confirmarSenha: "",
    telefone: "", municipioId: "",
  });
  const [aceite, setAceite] = useState(false);
  const [termoAberto, setTermoAberto] = useState(false);
  const [termo, setTermo] = useState<TermoLgpd | null>(null);
  const [carregandoTermo, setCarregandoTermo] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});

  function set(campo: string, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErros((e) => ({ ...e, [campo]: "" }));
  }

  function validar(): boolean {
    const novos: Record<string, string> = {};
    if (!form.nome.trim()) novos.nome = "Nome é obrigatório.";
    if (!/^\d{11}$/.test(form.cpf)) novos.cpf = "CPF deve ter 11 dígitos.";
    if (!form.email.includes("@")) novos.email = "E-mail inválido.";
    if (form.senha.length < 8) novos.senha = "Mínimo 8 caracteres.";
    if (form.senha !== form.confirmarSenha) novos.confirmarSenha = "As senhas não conferem.";
    if (!form.telefone.trim()) novos.telefone = "Telefone é obrigatório.";
    if (!aceite) novos.aceite = "Você deve aceitar os termos para continuar.";
    setErros(novos);
    return Object.keys(novos).length === 0;
  }

  async function abrirTermo() {
    if (termo) { setTermoAberto(true); return; }
    setCarregandoTermo(true);
    try {
      const t = await api.get<TermoLgpd>("/auth/termos-lgpd/atual");
      setTermo(t);
      setTermoAberto(true);
    } catch {
      setErro("Não foi possível carregar os termos de uso.");
    } finally {
      setCarregandoTermo(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!validar()) return;

    setCarregando(true);
    try {
      const payload: Record<string, unknown> = {
        nome: form.nome,
        cpf: form.cpf,
        email: form.email,
        senha: form.senha,
        confirmarSenha: form.confirmarSenha,
        telefone: form.telefone,
        aceiteTermoLgpd: true,
        versaoTermoAceito: termo?.versao ?? "1.0",
      };
      if (form.municipioId) payload.municipioId = Number(form.municipioId);

      const resp = await api.post<TokensResposta>("/auth/registrar", payload);
      salvarTokens(resp.accessToken, resp.refreshToken);
      navigate("/");
    } catch (err) {
      setErro(
        err instanceof ApiError ? err.message : "Erro ao criar conta. Tente novamente.",
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}

        <TextField
          label="Nome completo" fullWidth size="small" sx={{ mb: 2 }}
          value={form.nome} onChange={(e) => set("nome", e.target.value)}
          required error={!!erros.nome} helperText={erros.nome}
        />
        <TextField
          label="CPF (apenas números)" fullWidth size="small" sx={{ mb: 2 }}
          value={form.cpf} onChange={(e) => set("cpf", e.target.value.replace(/\D/g, ""))}
          required inputProps={{ maxLength: 11 }} error={!!erros.cpf} helperText={erros.cpf}
        />
        <TextField
          label="E-mail" type="email" fullWidth size="small" sx={{ mb: 2 }}
          value={form.email} onChange={(e) => set("email", e.target.value)}
          required error={!!erros.email} helperText={erros.email}
        />
        <TextField
          label="Senha" type="password" fullWidth size="small" sx={{ mb: 2 }}
          value={form.senha} onChange={(e) => set("senha", e.target.value)}
          required error={!!erros.senha} helperText={erros.senha || "Mínimo 8 caracteres."}
          autoComplete="new-password"
        />
        <TextField
          label="Confirmar senha" type="password" fullWidth size="small" sx={{ mb: 2 }}
          value={form.confirmarSenha} onChange={(e) => set("confirmarSenha", e.target.value)}
          required error={!!erros.confirmarSenha} helperText={erros.confirmarSenha}
          autoComplete="new-password"
        />

        <Divider sx={{ my: 1.5 }} />

        <TextField
          label="Telefone" fullWidth size="small" sx={{ mb: 2 }}
          value={form.telefone} onChange={(e) => set("telefone", e.target.value)}
          required error={!!erros.telefone} helperText={erros.telefone}
        />
        <TextField
          label="Código IBGE do município (opcional)" fullWidth size="small" sx={{ mb: 2 }}
          value={form.municipioId} onChange={(e) => set("municipioId", e.target.value.replace(/\D/g, ""))}
          helperText="7 dígitos. Deixe em branco se não souber."
        />

        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={aceite}
                onChange={(e) => { setAceite(e.target.checked); setErros((v) => ({ ...v, aceite: "" })); }}
                size="small"
              />
            }
            label={
              <Typography variant="body2">
                Li e aceito os{" "}
                <Typography
                  component="span"
                  variant="body2"
                  sx={{ color: "primary.main", cursor: "pointer", textDecoration: "underline" }}
                  onClick={(e) => { e.preventDefault(); void abrirTermo(); }}
                >
                  Termos de Uso e Política de Privacidade
                </Typography>
                {carregandoTermo && <CircularProgress size={12} sx={{ ml: 0.5 }} />}
              </Typography>
            }
          />
          {erros.aceite && <FormHelperText error>{erros.aceite}</FormHelperText>}
        </Box>

        <Button type="submit" variant="contained" fullWidth disabled={carregando} size="large">
          {carregando ? <CircularProgress size={22} color="inherit" /> : "Criar conta"}
        </Button>
      </Box>

      {/* Dialog Termos LGPD */}
      <Dialog open={termoAberto} onClose={() => setTermoAberto(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Termos de Uso e Política de Privacidade
          <IconButton onClick={() => setTermoAberto(false)} sx={{ position: "absolute", right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography
            variant="body2"
            component="pre"
            sx={{ whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.7 }}
          >
            {termo?.conteudo}
          </Typography>
        </DialogContent>
        <Box sx={{ p: 2, display: "flex", justifyContent: "flex-end" }}>
          <Button
            variant="contained"
            onClick={() => { setAceite(true); setTermoAberto(false); setErros((v) => ({ ...v, aceite: "" })); }}
          >
            Li e aceito
          </Button>
        </Box>
      </Dialog>
    </>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function LoginPage() {
  const [aba, setAba] = useState(0);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: cores.fundoPadrao,
        p: 2,
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 460 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 1.5 }}>
            <Box
              component="img"
              src="/logo.svg"
              alt="Defesa Civil MG"
              sx={{ width: 44, height: 44 }}
            />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Defesa Civil MG
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Sistema de Informações
              </Typography>
            </Box>
          </Box>

          <Tabs
            value={aba}
            onChange={(_, v: number) => setAba(v)}
            variant="fullWidth"
            sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
          >
            <Tab label="Entrar" />
            <Tab label="Criar conta" />
          </Tabs>

          {aba === 0 && <AbaEntrar />}
          {aba === 1 && <AbaCriarConta />}
        </CardContent>
      </Card>
    </Box>
  );
}
