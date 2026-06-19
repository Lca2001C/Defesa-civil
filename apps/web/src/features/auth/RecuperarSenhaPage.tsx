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
import { Link } from "react-router-dom";
import { ApiError } from "../../lib/api";
import { cores } from "../../theme/tokens";
import { AuthService } from "./services/auth.service";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      await AuthService.solicitarRecuperacao(email);
      setEnviado(true);
    } catch (err) {
      setErro(
        err instanceof ApiError ? err.message : "Erro ao enviar o e-mail. Tente novamente.",
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
            Recuperar senha
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Informe seu e-mail cadastrado e enviaremos um link para redefinir sua senha.
          </Typography>

          {enviado ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              Se o e-mail estiver cadastrado, você receberá as instruções em breve. Verifique
              também a caixa de spam.
            </Alert>
          ) : (
            <Box component="form" onSubmit={handleSubmit} noValidate>
              {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}

              <TextField
                label="E-mail"
                type="email"
                fullWidth
                size="small"
                sx={{ mb: 3 }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={carregando}
                size="large"
              >
                {carregando ? <CircularProgress size={22} color="inherit" /> : "Enviar link"}
              </Button>
            </Box>
          )}

          <Box sx={{ mt: 2, textAlign: "center" }}>
            <Typography
              component={Link}
              to="/login"
              variant="body2"
              sx={{ color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
            >
              ← Voltar ao login
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
