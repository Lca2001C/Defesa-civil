import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { runtimeConfig } from "../../lib/runtimeConfig";
import { getAccessToken } from "../../lib/auth";
import { useAuth } from "../../lib/auth-context";
import { cores } from "../../theme/tokens";
import { QUERY_KEYS } from "../../shared/constants";
import { DashboardService } from "./services/dashboard.service";
import { CompetenciasService } from "../competencias/services/competencias.service";

// ── helpers ───────────────────────────────────────────────────────────────────

function barra(valor: number, total: number, cor: string) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <Stack spacing={0.5}>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="caption">{valor}</Typography>
        <Typography variant="caption" color="text.secondary">
          {pct}%
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 6,
          borderRadius: 3,
          bgcolor: "rgba(148,163,184,.15)",
          "& .MuiLinearProgress-bar": { bgcolor: cor },
        }}
      />
    </Stack>
  );
}

// ── componente ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { usuario } = useAuth();
  const isSuperAdmin = usuario?.perfilCodigo === "SUPER_ADMIN";
  const [competenciaId, setCompetenciaId] = useState("");
  const [exportando, setExportando] = useState(false);

  const { data: competencias = [] } = useQuery({
    queryKey: [QUERY_KEYS.COMPETENCIAS],
    queryFn: () => CompetenciasService.listar(),
  });

  useEffect(() => {
    if (!competenciaId && competencias.length > 0) {
      const aberta = competencias.find((c) => c.status === "ABERTA") ?? competencias[0];
      setCompetenciaId(aberta.id);
    }
  }, [competencias, competenciaId]);

  const { data: resumo, isLoading: loadingResumo } = useQuery({
    queryKey: [QUERY_KEYS.DASHBOARD, "resumo", competenciaId],
    queryFn: () => DashboardService.resumo(competenciaId),
    enabled: !!competenciaId,
  });

  const { data: timeline = [] } = useQuery({
    queryKey: [QUERY_KEYS.DASHBOARD, "timeline", competenciaId],
    queryFn: () => DashboardService.timeline(competenciaId, 30),
    enabled: !!competenciaId,
  });

  const { data: porRegional = [] } = useQuery({
    queryKey: [QUERY_KEYS.DASHBOARD, "por-regional", competenciaId],
    queryFn: () => DashboardService.porRegional(competenciaId),
    enabled: !!competenciaId,
  });

  const { data: porFormulario = [] } = useQuery({
    queryKey: [QUERY_KEYS.DASHBOARD, "por-formulario", competenciaId],
    queryFn: () => DashboardService.porFormulario(competenciaId),
    enabled: !!competenciaId,
  });

  async function handleExportar() {
    if (!competenciaId) return;
    setExportando(true);
    try {
      // 1) Enfileira o job de exportação
      const { jobId } = await DashboardService.enfileirarExport(competenciaId);

      // 2) Polling do estado do job (~1,5s)
      const aguardar = (ms: number) => new Promise((r) => setTimeout(r, ms));
      for (let tentativa = 0; tentativa < 200; tentativa++) {
        const status = await DashboardService.consultarExport(jobId);
        if (status.estado === "completed") break;
        if (status.estado === "failed") throw new Error("A geração do relatório falhou.");
        await aguardar(1500);
      }

      // 3) Download do arquivo pronto (com Authorization)
      const base = runtimeConfig.apiBaseUrl.replace(/\/$/, "");
      const token = getAccessToken() ?? "";
      const resp = await fetch(`${base}/relatorios/export/${jobId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Falha ao baixar o relatório.");
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `submissoes_${competenciaId}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao exportar.");
    } finally {
      setExportando(false);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  const maxTimeline = Math.max(...timeline.map((t) => t.enviadas), 1);

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
          <Typography variant="h5">Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            Indicadores consolidados por competência
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
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
          <Button
            variant="contained"
            startIcon={exportando ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
            disabled={!competenciaId || exportando}
            onClick={handleExportar}
          >
            Exportar Excel
          </Button>
        </Stack>
      </Stack>

      {loadingResumo ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : resumo ? (
        <>
          {/* cards de resumo */}
          <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
            {[
              { rotulo: "Total", valor: resumo.total, cor: cores.textoPrimario },
              { rotulo: "Respondidas", valor: resumo.respondidas, cor: cores.laranjaPrimario },
              { rotulo: "Aprovadas", valor: resumo.aprovada, cor: cores.verdeSucesso },
              { rotulo: "Pendentes", valor: resumo.correcaoSolicitada, cor: cores.amareloAtencao },
              { rotulo: "Em análise", valor: resumo.enviada + resumo.revisada, cor: "#60a5fa" },
            ].map(({ rotulo, valor, cor }) => (
              <Card key={rotulo} sx={{ flex: "1 1 160px", minWidth: 140 }}>
                <CardContent sx={{ py: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    {rotulo}
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 700, color: cor, mt: 0.5 }}>
                    {valor}
                  </Typography>
                </CardContent>
              </Card>
            ))}
            {isSuperAdmin && (
              <Card sx={{ flex: "1 1 160px", minWidth: 140 }}>
                <CardContent sx={{ py: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Cobertura estadual
                  </Typography>
                  <Typography
                    variant="h3"
                    sx={{ fontWeight: 700, color: cores.laranjaPrimario, mt: 0.5 }}
                  >
                    {resumo.percentualCobertura.toFixed(1)}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={resumo.percentualCobertura}
                    sx={{
                      mt: 1,
                      height: 6,
                      borderRadius: 3,
                      bgcolor: "rgba(148,163,184,.15)",
                      "& .MuiLinearProgress-bar": { bgcolor: cores.laranjaPrimario },
                    }}
                  />
                </CardContent>
              </Card>
            )}
          </Stack>

          {/* linha: por regional + por formulário */}
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            {/* por regional */}
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Por Regional (REDEC)
                </Typography>
                {porRegional.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Sem dados
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Regional</TableCell>
                          <TableCell align="right">Total</TableCell>
                          <TableCell sx={{ minWidth: 120 }}>Aprovadas</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {porRegional.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.nome}</TableCell>
                            <TableCell align="right">{r.total}</TableCell>
                            <TableCell>
                              {barra(r.aprovadas, r.total, cores.verdeSucesso)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>

            {/* por formulário */}
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Por Formulário
                </Typography>
                {porFormulario.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Sem dados
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Formulário</TableCell>
                          <TableCell align="right">Total</TableCell>
                          <TableCell sx={{ minWidth: 120 }}>Aprovadas</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {porFormulario.map((f) => (
                          <TableRow key={f.formularioVersaoId}>
                            <TableCell>
                              {f.nome}
                              <Typography
                                component="span"
                                variant="caption"
                                color="text.secondary"
                                sx={{ ml: 0.5 }}
                              >
                                v{f.versao}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">{f.total}</TableCell>
                            <TableCell>
                              {barra(f.aprovadas, f.total, cores.verdeSucesso)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Stack>

          {/* timeline */}
          {timeline.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Submissões por dia (últimos 30 dias)
                </Typography>
                <Stack spacing={0.5}>
                  {timeline.map((t) => (
                    <Stack key={t.data} direction="row" alignItems="center" spacing={1}>
                      <Typography
                        variant="caption"
                        sx={{ width: 90, flexShrink: 0, fontFamily: "monospace" }}
                      >
                        {new Date(t.data + "T12:00:00").toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </Typography>
                      <Box sx={{ flex: 1, position: "relative", height: 14 }}>
                        {/* barra enviadas */}
                        <Box
                          sx={{
                            position: "absolute",
                            left: 0,
                            top: 2,
                            height: 10,
                            borderRadius: 1,
                            bgcolor: cores.laranjaPrimario,
                            width: `${(t.enviadas / maxTimeline) * 100}%`,
                            minWidth: t.enviadas > 0 ? 4 : 0,
                            opacity: 0.7,
                          }}
                        />
                        {/* barra validadas sobreposta */}
                        <Box
                          sx={{
                            position: "absolute",
                            left: 0,
                            top: 2,
                            height: 10,
                            borderRadius: 1,
                            bgcolor: cores.verdeSucesso,
                            width: `${(t.aprovadas / maxTimeline) * 100}%`,
                            minWidth: t.aprovadas > 0 ? 4 : 0,
                          }}
                        />
                      </Box>
                      <Typography variant="caption" sx={{ width: 50, textAlign: "right" }}>
                        {t.enviadas}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
                <Divider sx={{ my: 1.5 }} />
                <Stack direction="row" spacing={2}>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: cores.laranjaPrimario, opacity: 0.7 }} />
                    <Typography variant="caption" color="text.secondary">Enviadas</Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: cores.verdeSucesso }} />
                    <Typography variant="caption" color="text.secondary">Aprovadas</Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </Stack>
  );
}
