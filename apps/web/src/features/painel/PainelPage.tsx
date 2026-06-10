// Pagina inicial (HOME): Painel Estadual em Tempo Real.
// Exibe cards institucionais de indicadores no semaforo de status, uma area
// reservada ao mapa de Minas Gerais (placeholder) e o status atual da API.

import {
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import CircleIcon from "@mui/icons-material/Circle";
import { cores } from "../../theme/tokens";
import { useHealth } from "./useHealth";

interface IndicadorProps {
  rotulo: string;
  valor: number;
  cor: string;
  descricao: string;
}

function CartaoIndicador({ rotulo, valor, cor, descricao }: IndicadorProps) {
  return (
    <Card sx={{ flex: "1 1 220px", minWidth: 220 }}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <CircleIcon sx={{ color: cor, fontSize: 14 }} />
          <Typography variant="subtitle2" color="text.secondary">
            {rotulo}
          </Typography>
        </Stack>
        <Typography variant="h3" sx={{ fontWeight: 700, color: cor }}>
          {valor}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {descricao}
        </Typography>
      </CardContent>
    </Card>
  );
}

interface LegendaProps {
  cor: string;
  texto: string;
}

function ItemLegenda({ cor, texto }: LegendaProps) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <CircleIcon sx={{ color: cor, fontSize: 12 }} />
      <Typography variant="caption" color="text.secondary">
        {texto}
      </Typography>
    </Stack>
  );
}

export default function PainelPage() {
  const { data, isLoading, isError } = useHealth();

  // Indicadores placeholder (Fase 1) — serao alimentados pela API + WebSocket.
  const indicadores: IndicadorProps[] = [
    {
      rotulo: "Respondido",
      valor: 0,
      cor: cores.verdeSucesso,
      descricao: "Municipios com formulario concluido",
    },
    {
      rotulo: "Em preenchimento",
      valor: 0,
      cor: cores.amareloAtencao,
      descricao: "Municipios com resposta iniciada",
    },
    {
      rotulo: "Nao respondeu",
      valor: 0,
      cor: cores.vermelhoErro,
      descricao: "Municipios sem nenhuma resposta",
    },
  ];

  const statusApi = isLoading
    ? { texto: "Verificando...", cor: cores.amareloAtencao }
    : isError
      ? { texto: "API indisponivel", cor: cores.vermelhoErro }
      : {
          texto: `API operacional${data?.status ? ` (${data.status})` : ""}`,
          cor: cores.verdeSucesso,
        };

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={2}
      >
        <Box>
          <Typography variant="h5">Painel Estadual em Tempo Real</Typography>
          <Typography variant="body2" color="text.secondary">
            Acompanhamento da situacao dos municipios de Minas Gerais
          </Typography>
        </Box>
        <Chip
          icon={<CircleIcon sx={{ fontSize: "14px !important" }} />}
          label={statusApi.texto}
          variant="outlined"
          sx={{
            borderColor: statusApi.cor,
            color: statusApi.cor,
            "& .MuiChip-icon": { color: statusApi.cor },
          }}
        />
      </Stack>

      <Stack
        direction="row"
        spacing={2}
        useFlexGap
        sx={{ flexWrap: "wrap" }}
      >
        {indicadores.map((item) => (
          <CartaoIndicador key={item.rotulo} {...item} />
        ))}
      </Stack>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Mapa de Minas Gerais
          </Typography>
          <Box
            sx={{
              height: 360,
              borderRadius: 2,
              border: "1px dashed rgba(148, 163, 184, 0.35)",
              backgroundColor: cores.fundoSidebar,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Area reservada ao mapa interativo dos municipios (em breve)
            </Typography>
          </Box>
          <Stack
            direction="row"
            spacing={3}
            sx={{ mt: 2, flexWrap: "wrap" }}
            useFlexGap
          >
            <ItemLegenda cor={cores.verdeSucesso} texto="Respondido" />
            <ItemLegenda cor={cores.amareloAtencao} texto="Em preenchimento" />
            <ItemLegenda cor={cores.vermelhoErro} texto="Nao respondeu" />
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
