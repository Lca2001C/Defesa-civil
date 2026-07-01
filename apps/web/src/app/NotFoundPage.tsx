// Pagina 404 (catch-all) do roteador.
import { Box, Button, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <Box
      sx={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Stack spacing={2} alignItems="center" sx={{ maxWidth: "100%", textAlign: "center" }}>
        <Typography variant="h3" sx={{ fontWeight: 700 }}>
          404
        </Typography>
        <Typography variant="body1" color="text.secondary">
          A pagina solicitada nao foi encontrada.
        </Typography>
        <Button
          component={RouterLink}
          to="/"
          variant="contained"
          sx={{ width: { xs: "100%", sm: "auto" } }}
        >
          Voltar ao Painel
        </Button>
      </Stack>
    </Box>
  );
}
