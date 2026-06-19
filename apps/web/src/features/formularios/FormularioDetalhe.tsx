import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../lib/auth-context";
import { QUERY_KEYS } from "../../shared/constants";
import { FormulariosService } from "./services/formularios.service";
import { PreviewDialog } from "./builder/PreviewDialog";
import { useState } from "react";
import type { SchemaFormulario } from "@dcmg/contracts";

const COR_STATUS: Record<string, "default" | "warning" | "success" | "error"> = {
  RASCUNHO: "default",
  PUBLICADO: "success",
  ARQUIVADO: "error",
};

export default function FormularioDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const podeEditar = usuario?.permissoes.includes("formularios.criar") ?? false;
  const [previewSchema, setPreviewSchema] = useState<SchemaFormulario | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.FORMULARIOS, id],
    queryFn: () => FormulariosService.buscar(id!),
    enabled: !!id,
  });

  async function abrirPreview(versaoId: string) {
    const v = await FormulariosService.buscarVersao(id!, versaoId);
    setPreviewSchema(v.schema);
  }

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
      <Button startIcon={<ArrowBackIcon />} sx={{ mb: 2 }} onClick={() => navigate("/formularios")}>
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

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {data.versoes.map((v) => (
          <Card key={v.id}>
            <CardContent sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Box>
                <Typography variant="subtitle2">Versão {v.versao}</Typography>
                {v.competencia && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    Competência: {v.competencia.nome} ({v.competencia.status})
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  {v._count.submissoes} submissão{v._count.submissoes !== 1 ? "ões" : ""}
                  {v.publicadoEm
                    ? ` · publicado em ${new Date(v.publicadoEm).toLocaleDateString("pt-BR")}`
                    : ""}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <Chip label={v.status} color={COR_STATUS[v.status] ?? "default"} size="small" />
                <Button size="small" startIcon={<VisibilityIcon />} onClick={() => abrirPreview(v.id)}>
                  Preview
                </Button>
                {podeEditar && (
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => navigate(`/formularios/${id}/versoes/${v.id}/editar`)}
                  >
                    Editar
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {previewSchema && (
        <PreviewDialog aberto schema={previewSchema} onFechar={() => setPreviewSchema(null)} />
      )}
    </Box>
  );
}
