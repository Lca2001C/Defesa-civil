import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  TextField,
  Typography,
} from "@mui/material";
import ShieldIcon from "@mui/icons-material/Shield";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth-context";
import { api, ApiError } from "../../lib/api";
import { cores } from "../../theme/tokens";

interface TokensResposta {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export default function LoginPage() {
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
        err instanceof ApiError
          ? err.message
          : "Erro ao tentar fazer login. Tente novamente.",
      );
    } finally {
      setCarregando(false);
    }
  }

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
      <Card sx={{ width: "100%", maxWidth: 420 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 1.5 }}>
            <ShieldIcon sx={{ color: cores.laranjaPrimario, fontSize: 36 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Defesa Civil MG
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Sistema de Informações
              </Typography>
            </Box>
          </Box>

          {erro && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {erro}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
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
              sx={{ mb: 3 }}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              autoComplete="current-password"
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={carregando}
              size="large"
            >
              {carregando ? <CircularProgress size={22} color="inherit" /> : "Entrar"}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
