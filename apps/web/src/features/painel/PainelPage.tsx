import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import CircleIcon from "@mui/icons-material/Circle";
import { MapContainer, GeoJSON, TileLayer } from "react-leaflet";
import type { GeoJsonObject, Feature } from "geojson";
import type { Layer, PathOptions, LeafletMouseEvent } from "leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../../lib/api";
import { cores } from "../../theme/tokens";
import { usePainelSocket, type StatusUpdateEvento } from "../../hooks/usePainelSocket";

// ── tipos ─────────────────────────────────────────────────────────────────────

interface Competencia {
  id: string;
  nome: string;
  status: string;
}

interface MunicipioStatus {
  municipioId: number;
  codigoIbge: string;
  nome: string;
  status: "RESPONDIDO" | "EM_PREENCHIMENTO" | "NAO_RESPONDEU";
}

interface Estatisticas {
  respondido: number;
  emPreenchimento: number;
  naoRespondeu: number;
  total: number;
  percentual: number;
}

interface DrawerMunicipio {
  municipio: {
    id: number;
    nome: string;
    codigoIbge: string;
  };
  compdec: {
    coordenadorNome?: string;
    telefone?: string;
    email?: string;
  } | null;
  submissoesRecentes: Array<{
    id: string;
    protocolo?: string;
    status: string;
    createdAt: string;
    nomeRespondente?: string;
  }>;
}

// ── cores de status ───────────────────────────────────────────────────────────

const COR_STATUS: Record<string, string> = {
  RESPONDIDO: cores.verdeSucesso,
  EM_PREENCHIMENTO: cores.amareloAtencao,
  NAO_RESPONDEU: cores.vermelhoErro,
};

const LABEL_STATUS: Record<string, string> = {
  RESPONDIDO: "Respondido",
  EM_PREENCHIMENTO: "Em preenchimento",
  NAO_RESPONDEU: "Não respondeu",
};

// ── componentes auxiliares ────────────────────────────────────────────────────

function CartaoIndicador({
  rotulo,
  valor,
  cor,
  descricao,
}: {
  rotulo: string;
  valor: number;
  cor: string;
  descricao: string;
}) {
  return (
    <Card sx={{ flex: "1 1 200px", minWidth: 180 }}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <CircleIcon sx={{ color: cor, fontSize: 13 }} />
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

// ── painel page ───────────────────────────────────────────────────────────────

export default function PainelPage() {
  const [competenciaId, setCompetenciaId] = useState<string>("");
  const [drawerMunicipioId, setDrawerMunicipioId] = useState<number | null>(null);
  const [geojson, setGeojson] = useState<GeoJsonObject | null>(null);

  // mapa em memória: codigoIbge → status (atualizado por WS sem re-render do GeoJSON)
  const statusMapRef = useRef<Map<string, string>>(new Map());
  const geojsonLayerRef = useRef<{ [ibge: string]: Layer & { setStyle: (s: PathOptions) => void } }>({});

  // ── competências ──────────────────────────────────────────────────────────
  const { data: competencias = [] } = useQuery<Competencia[]>({
    queryKey: ["competencias"],
    queryFn: () =>
      api.get<{ items: Competencia[] }>("/competencias").then((r) => r.items),
  });

  useEffect(() => {
    if (!competenciaId && competencias.length > 0) {
      const aberta = competencias.find((c) => c.status === "ABERTA") ?? competencias[0];
      setCompetenciaId(aberta.id);
    }
  }, [competencias, competenciaId]);

  // ── status municípios ─────────────────────────────────────────────────────
  const { data: statusLista = [], isLoading: loadingStatus } = useQuery<MunicipioStatus[]>({
    queryKey: ["painel", "status", competenciaId],
    queryFn: () => api.get<MunicipioStatus[]>(`/painel/status?competenciaId=${competenciaId}`),
    enabled: !!competenciaId,
    staleTime: 30_000,
  });

  useEffect(() => {
    statusMapRef.current.clear();
    for (const m of statusLista) {
      // A malha GeoJSON é indexada pelo código IBGE (= municipioId de 7 dígitos).
      statusMapRef.current.set(String(m.municipioId), m.status);
    }
    // repintar layers existentes
    Object.entries(geojsonLayerRef.current).forEach(([ibge, layer]) => {
      const st = statusMapRef.current.get(ibge) ?? "NAO_RESPONDEU";
      layer.setStyle({ fillColor: COR_STATUS[st], fillOpacity: 0.75, weight: 0.5, color: "#1e3a5f" });
    });
  }, [statusLista]);

  // ── estatísticas ──────────────────────────────────────────────────────────
  const { data: stats, refetch: refetchStats } = useQuery<Estatisticas>({
    queryKey: ["painel", "stats", competenciaId],
    queryFn: () => api.get<Estatisticas>(`/painel/stats?competenciaId=${competenciaId}`),
    enabled: !!competenciaId,
    staleTime: 30_000,
  });

  // ── drawer município ──────────────────────────────────────────────────────
  const { data: drawerData } = useQuery<DrawerMunicipio>({
    queryKey: ["painel", "municipio", drawerMunicipioId, competenciaId],
    queryFn: () =>
      api.get<DrawerMunicipio>(`/painel/municipio/${drawerMunicipioId}?competenciaId=${competenciaId}`),
    enabled: drawerMunicipioId !== null && !!competenciaId,
  });

  // ── websocket ─────────────────────────────────────────────────────────────
  const onStatusUpdate = useCallback(
    (evento: StatusUpdateEvento) => {
      if (evento.competenciaId !== competenciaId) return;
      const ibge = String(evento.municipioId);
      statusMapRef.current.set(ibge, evento.status);
      const layer = geojsonLayerRef.current[ibge];
      if (layer) {
        layer.setStyle({
          fillColor: COR_STATUS[evento.status],
          fillOpacity: 0.75,
          weight: 0.5,
          color: "#1e3a5f",
        });
      }
      void refetchStats();
    },
    [competenciaId, refetchStats]
  );

  const onStats = useCallback(
    (_: Record<string, number>) => {
      void refetchStats();
    },
    [refetchStats]
  );

  usePainelSocket({ competenciaId: competenciaId || null, onStatusUpdate, onStats });

  // ── GeoJSON de MG ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/municipios-mg.geojson")
      .then((r) => {
        if (!r.ok) throw new Error("GeoJSON não encontrado");
        return r.json() as Promise<GeoJsonObject>;
      })
      .then(setGeojson)
      .catch(() => setGeojson(null));
  }, []);

  // ── estilos do GeoJSON ────────────────────────────────────────────────────
  const styleFeature = useCallback(
    (feature?: Feature): PathOptions => {
      const ibge = String(
        feature?.properties?.GEOCODIGO ??
        feature?.properties?.CD_MUN ??
        feature?.properties?.codarea ??
        feature?.properties?.geocodigo ??
        ""
      );
      const st = statusMapRef.current.get(ibge) ?? "NAO_RESPONDEU";
      return {
        fillColor: COR_STATUS[st],
        fillOpacity: 0.75,
        weight: 0.5,
        color: "#1e3a5f",
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statusLista]
  );

  const onEachFeature = useCallback(
    (feature: Feature, layer: Layer) => {
      const ibge = String(
        feature?.properties?.GEOCODIGO ??
        feature?.properties?.CD_MUN ??
        feature?.properties?.codarea ??
        feature?.properties?.geocodigo ??
        ""
      );
      if (ibge) {
        (geojsonLayerRef.current as Record<string, typeof layer>)[ibge] = layer as typeof layer & {
          setStyle: (s: PathOptions) => void;
        };
      }
      const nome =
        feature?.properties?.NOME ??
        feature?.properties?.NM_MUN ??
        feature?.properties?.nome ??
        "Município";
      (layer as Layer & { bindTooltip: (s: string) => void }).bindTooltip(nome);
      layer.on("click", (e: LeafletMouseEvent) => {
        e.originalEvent?.stopPropagation();
        const mid = Number(ibge);
        if (!isNaN(mid) && mid > 0) setDrawerMunicipioId(mid);
      });
    },
    []
  );

  // ── render ────────────────────────────────────────────────────────────────

  const respondido = stats?.respondido ?? 0;
  const emPreenchimento = stats?.emPreenchimento ?? 0;
  const naoRespondeu = stats?.naoRespondeu ?? 853;
  const percentual = stats?.percentual ?? 0;

  return (
    <Stack spacing={3}>
      {/* cabeçalho */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={2}
      >
        <Box>
          <Typography variant="h5">Painel Estadual em Tempo Real</Typography>
          <Typography variant="body2" color="text.secondary">
            Acompanhamento dos 853 municípios de Minas Gerais
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Competência</InputLabel>
          <Select
            label="Competência"
            value={competenciaId}
            onChange={(e) => setCompetenciaId(e.target.value)}
          >
            {competencias.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.nome}
                {c.status === "ABERTA" && (
                  <Chip label="Aberta" size="small" sx={{ ml: 1, height: 18 }} />
                )}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {/* cards de indicadores */}
      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
        <CartaoIndicador
          rotulo="Respondido"
          valor={respondido}
          cor={cores.verdeSucesso}
          descricao="Municípios com formulário concluído"
        />
        <CartaoIndicador
          rotulo="Em preenchimento"
          valor={emPreenchimento}
          cor={cores.amareloAtencao}
          descricao="Municípios com rascunho em aberto"
        />
        <CartaoIndicador
          rotulo="Não respondeu"
          valor={naoRespondeu}
          cor={cores.vermelhoErro}
          descricao="Municípios sem nenhuma resposta"
        />
        <Card sx={{ flex: "1 1 200px", minWidth: 180 }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Cobertura estadual
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 700, color: cores.laranjaPrimario }}>
              {percentual.toFixed(1)}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              formulários respondidos
            </Typography>
          </CardContent>
        </Card>
      </Stack>

      {/* mapa */}
      <Card>
        <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
          <Box sx={{ p: 2, borderBottom: "1px solid rgba(148,163,184,.15)" }}>
            <Typography variant="h6">Mapa de Minas Gerais</Typography>
          </Box>
          <Box sx={{ height: 480, position: "relative" }}>
            {loadingStatus && (
              <Box
                sx={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  zIndex: 1000,
                  bgcolor: "background.paper",
                  borderRadius: 1,
                  p: 0.5,
                }}
              >
                <CircularProgress size={18} />
              </Box>
            )}
            {geojson ? (
              <MapContainer
                center={[-18.5, -44.5]}
                zoom={6}
                style={{ height: "100%", width: "100%", background: cores.fundoSidebar }}
                zoomControl
              >
                {/* tile layer escuro (CartoDB Dark Matter) */}
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
                />
                <GeoJSON
                  key={competenciaId}
                  data={geojson}
                  style={styleFeature}
                  onEachFeature={onEachFeature}
                />
              </MapContainer>
            ) : (
              <Box
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  bgcolor: cores.fundoSidebar,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Mapa indisponível
                </Typography>
                <Typography variant="caption" color="text.secondary" align="center" sx={{ maxWidth: 360 }}>
                  Coloque o arquivo <code>municipios-mg.geojson</code> em{" "}
                  <code>apps/web/public/</code> para ativar o mapa interativo.
                </Typography>
              </Box>
            )}
          </Box>
          {/* legenda */}
          <Stack direction="row" spacing={3} sx={{ p: 2, flexWrap: "wrap" }} useFlexGap>
            {(["RESPONDIDO", "EM_PREENCHIMENTO", "NAO_RESPONDEU"] as const).map((st) => (
              <Stack key={st} direction="row" spacing={0.5} alignItems="center">
                <CircleIcon sx={{ color: COR_STATUS[st], fontSize: 12 }} />
                <Typography variant="caption" color="text.secondary">
                  {LABEL_STATUS[st]}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* drawer do município */}
      <Drawer
        anchor="right"
        open={drawerMunicipioId !== null}
        onClose={() => setDrawerMunicipioId(null)}
        PaperProps={{ sx: { width: 380, bgcolor: "background.paper", p: 3 } }}
      >
        {drawerData ? (
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6">{drawerData.municipio.nome}</Typography>
              <Typography variant="caption" color="text.secondary">
                IBGE: {drawerData.municipio.codigoIbge}
              </Typography>
            </Box>
            <Divider />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                COMPDEC
              </Typography>
              {drawerData.compdec ? (
                <Stack spacing={0.5}>
                  {drawerData.compdec.coordenadorNome && (
                    <Typography variant="body2">
                      <strong>Coordenador:</strong> {drawerData.compdec.coordenadorNome}
                    </Typography>
                  )}
                  {drawerData.compdec.telefone && (
                    <Typography variant="body2">
                      <strong>Telefone:</strong> {drawerData.compdec.telefone}
                    </Typography>
                  )}
                  {drawerData.compdec.email && (
                    <Typography variant="body2">
                      <strong>E-mail:</strong> {drawerData.compdec.email}
                    </Typography>
                  )}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Sem dados cadastrados
                </Typography>
              )}
            </Box>
            <Divider />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Submissões recentes
              </Typography>
              {drawerData.submissoesRecentes.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhuma submissão nesta competência
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {drawerData.submissoesRecentes.map((s) => (
                    <Box
                      key={s.id}
                      sx={{
                        p: 1.5,
                        borderRadius: 1,
                        border: "1px solid rgba(148,163,184,.2)",
                        bgcolor: cores.fundoSidebar,
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                          {s.protocolo ?? s.id.slice(0, 8)}
                        </Typography>
                        <Chip
                          label={s.status}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: "0.6rem",
                            bgcolor:
                              s.status === "APROVADO"
                                ? cores.verdeSucesso
                                : s.status === "CORRECAO_SOLICITADA"
                                  ? cores.vermelhoErro
                                  : cores.amareloAtencao,
                            color: "#fff",
                          }}
                        />
                      </Stack>
                      {s.nomeRespondente && (
                        <Typography variant="caption" color="text.secondary">
                          {s.nomeRespondente}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary" display="block">
                        {new Date(s.createdAt).toLocaleString("pt-BR")}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </Stack>
        ) : (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
            <CircularProgress />
          </Box>
        )}
      </Drawer>
    </Stack>
  );
}
