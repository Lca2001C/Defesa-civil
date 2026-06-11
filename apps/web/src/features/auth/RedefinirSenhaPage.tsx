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
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { cores } from "../../theme/tokens";

export default function RedefinirSenhaPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  if (!token) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: cores.fundoPadrao, p: 2 }}>
        <Card sx={{ width: "100%", maxWidth: 420 }}>
          <CardContent sx={{ p: 4 }}>
            <Alert severity="error">
              Link inválido ou expirado. Solicite um novo link de recuperação.
            </Alert>
            <Box sx={{ mt: 2, textAlign: "center" }}>
              <Typography component={Link} to="/recuperar-senha" variant="body2"
                sx={{ color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                Solicitar novo link
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (novaSenha.length < 8) {
      setErro("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (novaSenha !== confirmar) {
      setErro("As senhas não conferem.");
      return;
    }

    setCarregando(true);
    try {
      await api.post("/auth/recuperar-senha/redefinir", { token, novaSenha });
      setSucesso(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      setErro(
        err instanceof ApiError ? err.message : "Erro ao redefinir a senha. Tente novamente.",
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
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Redefinir senha
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Escolha uma nova senha de no mínimo 8 caracteres.
          </Typography>

          {sucesso ? (
            <Alert severity="success">
              Senha redefinida com sucesso! Você será redirecionado para o login em instantes.
            </Alert>
          ) : (
            <Box component="form" onSubmit={handleSubmit} noValidate>
              {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}

              <TextField
                label="Nova senha"
                type="password"
                fullWidth
                size="small"
                sx={{ mb: 2 }}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                required
                autoFocus
                autoComplete="new-password"
                helperText="Mínimo 8 caracteres."
              />
              <TextField
                label="Confirmar nova senha"
                type="password"
                fullWidth
                size="small"
                sx={{ mb: 3 }}
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                required
                autoComplete="new-password"
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={carregando}
                size="large"
              >
                {carregando ? <CircularProgress size={22} color="inherit" /> : "Redefinir senha"}
              </Button>
            </Box>
          )}

          <Box sx={{ mt: 2, textAlign: "center" }}>
            <Typography component={Link} to="/login" variant="body2"
              sx={{ color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
              ← Voltar ao login
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
