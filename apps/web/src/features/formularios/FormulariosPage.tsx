import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DescriptionIcon from "@mui/icons-material/Description";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

interface Formulario {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  status: string;
  _count: { versoes: number };
  criadoEm: string;
}

interface ListagemFormularios {
  items: Formulario[];
  total: number;
  pagina: number;
  totalPaginas: number;
}

const COR_STATUS: Record<string, "default" | "warning" | "success" | "error"> = {
  RASCUNHO: "default",
  PUBLICADO: "success",
  ARQUIVADO: "error",
};

export default function FormulariosPage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const podeGerenciar = usuario?.permissoes.includes("formularios.criar") ?? false;

  const { data, isLoading } = useQuery({
    queryKey: ["formularios"],
    queryFn: () => api.get<ListagemFormularios>("/formularios?porPagina=50"),
  });

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h5">Formulários</Typography>
          <Typography variant="body2" color="text.secondary">
            {data ? `${data.total} formulário${data.total !== 1 ? "s" : ""} cadastrado${data.total !== 1 ? "s" : ""}` : "Carregando…"}
          </Typography>
        </Box>
        {podeGerenciar && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate("/formularios/novo")}
          >
            Novo formulário
          </Button>
        )}
      </Box>

      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {!isLoading && data?.items.length === 0 && (
        <Box sx={{ textAlign: "center", mt: 6, color: "text.secondary" }}>
          <DescriptionIcon sx={{ fontSize: 56, mb: 1, opacity: 0.4 }} />
          <Typography>Nenhum formulário cadastrado.</Typography>
          {podeGerenciar && (
            <Button sx={{ mt: 2 }} onClick={() => navigate("/formularios/novo")}>
              Criar o primeiro formulário
            </Button>
          )}
        </Box>
      )}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {data?.items.map((f) => (
          <Card key={f.id}>
            <CardActionArea onClick={() => navigate(`/formularios/${f.id}`)}>
              <CardContent sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {f.nome}
                  </Typography>
                  {f.descricao && (
                    <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 500 }}>
                      {f.descricao}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {f._count.versoes} versão{f._count.versoes !== 1 ? "ões" : ""}
                    {f.categoria ? ` · ${f.categoria}` : ""}
                  </Typography>
                </Box>
                <Chip
                  label={f.status}
                  color={COR_STATUS[f.status] ?? "default"}
                  size="small"
                />
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
