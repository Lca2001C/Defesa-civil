import { useState } from "react";
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
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  IconButton,
  Radio,
  RadioGroup,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../lib/auth-context";
import { ApiError } from "../../lib/api";
import { cores } from "../../theme/tokens";
import { AuthService } from "./services/auth.service";
import type { TermoLgpd, RegistrarPayload } from "./types";

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
      const resp = await AuthService.login(email, senha);
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [form, setForm] = useState({
    nome: "", cpf: "", email: "", senha: "", confirmarSenha: "",
    telefone: "", municipioId: "",
  });
  const [ehCoordenador, setEhCoordenador] = useState<"sim" | "nao" | "">("");
  const [, setAceite] = useState(false);
  const [termoLido, setTermoLido] = useState(false);
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
    if (!ehCoordenador) novos.ehCoordenador = "Informe se você é Coordenador de COMPDEC.";
    if (ehCoordenador === "sim" && !form.municipioId.trim())
      novos.municipioId = "Código IBGE é obrigatório para Coordenadores de COMPDEC.";
    if (!termoLido) novos.aceite = "Você precisa ler e aceitar os Termos de Uso antes de continuar.";
    setErros(novos);
    return Object.keys(novos).length === 0;
  }

  async function abrirTermo() {
    if (termo) { setTermoAberto(true); return; }
    setCarregandoTermo(true);
    try {
      const t = await AuthService.termoAtual();
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
      const payload: RegistrarPayload = {
        nome: form.nome,
        cpf: form.cpf,
        email: form.email,
        senha: form.senha,
        confirmarSenha: form.confirmarSenha,
        telefone: form.telefone,
        aceiteTermoLgpd: true,
        versaoTermoAceito: termo?.versao ?? "1.0",
        ehCoordenadorCompdec: ehCoordenador === "sim",
        ...(form.municipioId ? { municipioId: Number(form.municipioId) } : {}),
      };

      const resp = await AuthService.registrar(payload);
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
          label={ehCoordenador === "sim" ? "Código IBGE do município *" : "Código IBGE do município (opcional)"}
          fullWidth size="small" sx={{ mb: 2 }}
          value={form.municipioId} onChange={(e) => set("municipioId", e.target.value.replace(/\D/g, ""))}
          required={ehCoordenador === "sim"}
          error={!!erros.municipioId} helperText={erros.municipioId || "7 dígitos."}
        />

        <FormControl error={!!erros.ehCoordenador} sx={{ mb: 2, width: "100%" }}>
          <FormLabel sx={{ fontSize: 14, mb: 0.5 }}>
            Você é Coordenador de COMPDEC? *
          </FormLabel>
          <RadioGroup
            value={ehCoordenador}
            onChange={(e) => {
              setEhCoordenador(e.target.value as "sim" | "nao");
              setErros((v) => ({ ...v, ehCoordenador: "", municipioId: "" }));
            }}
            sx={{ flexDirection: { xs: "column", sm: "row" } }}
          >
            <FormControlLabel value="sim" control={<Radio size="small" />} label="Sim, sou Coordenador de COMPDEC" />
            <FormControlLabel value="nao" control={<Radio size="small" />} label="Não sou Coordenador de COMPDEC" />
          </RadioGroup>
          {erros.ehCoordenador && <FormHelperText>{erros.ehCoordenador}</FormHelperText>}
        </FormControl>

        <Box
          sx={{
            mb: 2,
            p: 1.5,
            border: "1px solid",
            borderColor: erros.aceite ? "error.main" : termoLido ? "success.main" : "divider",
            borderRadius: 1,
            backgroundColor: termoLido ? "success.50" : "transparent",
          }}
        >
          {!termoLido ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Para finalizar o cadastro, você deve ler e aceitar os Termos de Uso e Política de Privacidade.
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => void abrirTermo()}
                disabled={carregandoTermo}
              >
                {carregandoTermo
                  ? <><CircularProgress size={14} sx={{ mr: 1 }} />Carregando…</>
                  : "Ler Termos de Uso e Política de Privacidade"}
              </Button>
            </>
          ) : (
            <FormControlLabel
              control={<Checkbox checked size="small" disabled />}
              label={
                <Typography variant="body2" color="success.dark" sx={{ fontWeight: 500 }}>
                  Termos lidos e aceitos
                </Typography>
              }
            />
          )}
          {erros.aceite && <FormHelperText error sx={{ mt: 0.5 }}>{erros.aceite}</FormHelperText>}
        </Box>

        <Button type="submit" variant="contained" fullWidth disabled={carregando} size="large">
          {carregando ? <CircularProgress size={22} color="inherit" /> : "Criar conta"}
        </Button>
      </Box>

      {/* Dialog Termos LGPD */}
      <Dialog open={termoAberto} onClose={() => setTermoAberto(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ pr: 6 }}>
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
        <Box sx={{ p: 2, display: "flex", justifyContent: { xs: "stretch", sm: "flex-end" } }}>
          <Button
            variant="contained"
            fullWidth={isMobile}
            onClick={() => {
              setTermoLido(true);
              setAceite(true);
              setTermoAberto(false);
              setErros((v) => ({ ...v, aceite: "" }));
            }}
          >
            Li e aceito os Termos
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
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              Defesa Civil MG
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Sistema de Informações
            </Typography>
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
