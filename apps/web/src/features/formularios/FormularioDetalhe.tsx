import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { DynamicForm } from "../../components/dynamic-form";
import type { SchemaFormulario } from "@dcmg/contracts";

interface Versao {
  id: string;
  versao: number;
  status: string;
  publicadoEm: string | null;
  competencia: { nome: string; status: string } | null;
  schema: SchemaFormulario;
}

interface FormularioDetalheData {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  status: string;
  versoes: Versao[];
}

const COR_STATUS: Record<string, "default" | "warning" | "success" | "error"> = {
  RASCUNHO: "default",
  PUBLICADO: "success",
  ARQUIVADO: "error",
};

export default function FormularioDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [versaoPreview, setVersaoPreview] = useState<Versao | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["formularios", id],
    queryFn: () => api.get<FormularioDetalheData>(`/formularios/${id}`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!data) return null;

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2 }}
        onClick={() => navigate("/formularios")}
      >
        Voltar
      </Button>

      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
        <Box>
          <Typography variant="h5">{data.nome}</Typography>
          {data.descricao && (
            <Typography variant="body2" color="text.secondary">
              {data.descricao}
            </Typography>
          )}
          {data.categoria && (
            <Typography variant="caption" color="text.secondary">
              Categoria: {data.categoria}
            </Typography>
          )}
        </Box>
        <Chip label={data.status} color={COR_STATUS[data.status] ?? "default"} />
      </Box>

      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Versões ({data.versoes.length})
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 4 }}>
        {data.versoes.map((v) => (
          <Card key={v.id}>
            <CardContent
              sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <Box>
                <Typography variant="subtitle2">Versão {v.versao}</Typography>
                {v.competencia && (
                  <Typography variant="caption" color="text.secondary">
                    Competência: {v.competencia.nome} ({v.competencia.status})
                  </Typography>
                )}
                {v.publicadoEm && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    Publicado em: {new Date(v.publicadoEm).toLocaleDateString("pt-BR")}
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <Chip label={v.status} color={COR_STATUS[v.status] ?? "default"} size="small" />
                <Button
                  size="small"
                  startIcon={<VisibilityIcon />}
                  onClick={() => setVersaoPreview(versaoPreview?.id === v.id ? null : v)}
                >
                  {versaoPreview?.id === v.id ? "Fechar" : "Preview"}
                </Button>
              </Box>
            </CardContent>

            {versaoPreview?.id === v.id && (
              <Box sx={{ px: 3, pb: 3 }}>
                <Divider sx={{ mb: 3 }} />
                <DynamicForm
                  schema={v.schema}
                  onSubmit={() => {}}
                  preview
                />
              </Box>
            )}
          </Card>
        ))}
      </Box>
    </Box>
  );
}
