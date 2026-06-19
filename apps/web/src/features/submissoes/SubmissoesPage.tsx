import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import AssignmentIcon from "@mui/icons-material/Assignment";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import ClearIcon from "@mui/icons-material/Clear";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth-context";
import { exportarSubmissoes, type FiltrosExport } from "../../lib/exportSubmissoes";
import { QUERY_KEYS } from "../../shared/constants";
import { SubmissoesService } from "./services/submissoes.service";
import type { SubmissaoLista } from "./types";
import { MunicipiosService } from "../municipios/services/municipios.service";
import { CompetenciasService } from "../competencias/services/competencias.service";

type Submissao = SubmissaoLista;

const COR_STATUS: Record<string, "default" | "info" | "warning" | "success" | "error"> = {
  RASCUNHO: "default",
  EM_PREENCHIMENTO: "info",
  ENVIADO: "info",
  CORRECAO_SOLICITADA: "error",
  REVISADO: "warning",
  APROVADO: "success",
};

const LABEL_STATUS: Record<string, string> = {
  RASCUNHO: "Rascunho",
  EM_PREENCHIMENTO: "Em preenchimento",
  ENVIADO: "Enviado",
  CORRECAO_SOLICITADA: "Correção solicitada",
  REVISADO: "Revisado",
  APROVADO: "Aprovado",
};

const STATUS_EXCLUIVEIS = new Set(["RASCUNHO", "EM_PREENCHIMENTO"]);

export default function SubmissoesPage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const podeCriar = usuario?.permissoes.includes("submissoes.criar") ?? false;
  const podeExportar = usuario?.permissoes.includes("relatorios.exportar") ?? false;
  const isAdmin = (usuario?.perfilNivel ?? 0) >= 80;

  // ── estado de filtros ──────────────────────────────────────────────────────
  const [buscaInput, setBuscaInput] = useState("");
  const [busca, setBusca] = useState(""); // valor com debounce
  const [municipioId, setMunicipioId] = useState("");
  const [competenciaId, setCompetenciaId] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [pagina, setPagina] = useState(0); // 0-based (MUI)
  const [porPagina, setPorPagina] = useState(25);

  // ── exclusão / exportação ──────────────────────────────────────────────────
  const [excluindo, setExcluindo] = useState<Submissao | null>(null);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const [progressoExport, setProgressoExport] = useState(0);
  const [erroExport, setErroExport] = useState<string | null>(null);

  // Debounce da busca (~400ms) e reset de página ao mudar o texto.
  useEffect(() => {
    const t = setTimeout(() => {
      setBusca(buscaInput.trim());
      setPagina(0);
    }, 400);
    return () => clearTimeout(t);
  }, [buscaInput]);

  // Qualquer mudança de filtro volta para a primeira página.
  useEffect(() => {
    setPagina(0);
  }, [municipioId, competenciaId, statusFiltro, dataInicio, dataFim, porPagina]);

  const algumFiltroAtivo =
    !!busca || !!municipioId || !!competenciaId || !!statusFiltro || !!dataInicio || !!dataFim;

  const filtrosExport: FiltrosExport = useMemo(
    () => ({
      busca: busca || undefined,
      municipioId: municipioId || undefined,
      competenciaId: competenciaId || undefined,
      status: statusFiltro || undefined,
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
    }),
    [busca, municipioId, competenciaId, statusFiltro, dataInicio, dataFim],
  );

  // ── dados auxiliares (selects) ─────────────────────────────────────────────
  const { data: municipios = [] } = useQuery({
    queryKey: ["municipios-lista"],
    queryFn: () => MunicipiosService.listarParaSelecao(),
    staleTime: 60 * 60 * 1000,
  });

  const { data: competencias = [] } = useQuery({
    queryKey: ["competencias-lista"],
    queryFn: () => CompetenciasService.listar(),
    staleTime: 5 * 60 * 1000,
  });

  // ── listagem ───────────────────────────────────────────────────────────────
  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("pagina", String(pagina + 1));
    p.set("porPagina", String(porPagina));
    if (busca) p.set("busca", busca);
    if (municipioId) p.set("municipioId", municipioId);
    if (competenciaId) p.set("competenciaId", competenciaId);
    if (statusFiltro) p.set("status", statusFiltro);
    if (dataInicio) p.set("dataInicio", dataInicio);
    if (dataFim) p.set("dataFim", dataFim);
    return p.toString();
  }, [pagina, porPagina, busca, municipioId, competenciaId, statusFiltro, dataInicio, dataFim]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [QUERY_KEYS.SUBMISSOES, queryString],
    queryFn: () => SubmissoesService.listar(queryString),
  });

  const mutarExcluir = useMutation({
    mutationFn: (id: string) => SubmissoesService.excluir(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QUERY_KEYS.SUBMISSOES] });
      setExcluindo(null);
      setErroExclusao(null);
    },
    onError: (err: unknown) => {
      setErroExclusao(err instanceof Error ? err.message : "Erro ao excluir submissão.");
    },
  });

  function limparFiltros() {
    setBuscaInput("");
    setBusca("");
    setMunicipioId("");
    setCompetenciaId("");
    setStatusFiltro("");
    setDataInicio("");
    setDataFim("");
  }

  async function handleExportar() {
    setExportando(true);
    setProgressoExport(0);
    setErroExport(null);
    try {
      await exportarSubmissoes(filtrosExport, setProgressoExport);
    } catch (e) {
      setErroExport(e instanceof Error ? e.message : "Falha na exportação.");
    } finally {
      setExportando(false);
    }
  }

  const items = data?.items ?? [];

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, gap: 1, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h5">Submissões</Typography>
          <Typography variant="body2" color="text.secondary">
            {data ? `${data.total} registro(s)` : "Carregando…"}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          {podeExportar && (
            <Button
              variant="outlined"
              startIcon={exportando ? <CircularProgress size={16} /> : <DownloadIcon />}
              onClick={handleExportar}
              disabled={exportando}
            >
              {exportando ? `Exportando… ${progressoExport}%` : "Exportar (Excel)"}
            </Button>
          )}
          {podeCriar && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate("/submissoes/nova")}>
              Nova resposta
            </Button>
          )}
        </Box>
      </Box>

      {erroExport && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErroExport(null)}>
          {erroExport}
        </Alert>
      )}

      {/* Barra de filtros */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          <TextField
            size="small"
            label="Buscar"
            placeholder="Protocolo, município, respondente ou CPF"
            value={buscaInput}
            onChange={(e) => setBuscaInput(e.target.value)}
            sx={{ minWidth: 280, flex: 1 }}
          />
          <Autocomplete
            size="small"
            options={municipios}
            getOptionLabel={(o) => `${o.nome} (${o.id})`}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            value={municipios.find((m) => String(m.id) === municipioId) ?? null}
            onChange={(_, opcao) => setMunicipioId(opcao ? String(opcao.id) : "")}
            renderInput={(params) => <TextField {...params} label="Município" />}
            sx={{ minWidth: 240 }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Competência</InputLabel>
            <Select
              value={competenciaId}
              label="Competência"
              onChange={(e) => setCompetenciaId(e.target.value)}
            >
              <MenuItem value="">Todas</MenuItem>
              {competencias.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.nome}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFiltro} label="Status" onChange={(e) => setStatusFiltro(e.target.value)}>
              <MenuItem value="">Todos</MenuItem>
              {Object.entries(LABEL_STATUS).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  {v}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            type="date"
            label="De"
            InputLabelProps={{ shrink: true }}
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            sx={{ width: 160 }}
          />
          <TextField
            size="small"
            type="date"
            label="Até"
            InputLabelProps={{ shrink: true }}
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            sx={{ width: 160 }}
          />
          {algumFiltroAtivo && (
            <Button size="small" startIcon={<ClearIcon />} onClick={limparFiltros}>
              Limpar
            </Button>
          )}
        </Box>
      </Paper>

      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {!isLoading && items.length === 0 && (
        <Box sx={{ textAlign: "center", mt: 6, color: "text.secondary" }}>
          <AssignmentIcon sx={{ fontSize: 56, mb: 1, opacity: 0.4 }} />
          <Typography>Nenhuma submissão encontrada.</Typography>
        </Box>
      )}

      {!isLoading && items.length > 0 && (
        <Paper variant="outlined">
          {isFetching && <LinearProgress />}
          <TableContainer>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Protocolo</TableCell>
                  <TableCell>Município</TableCell>
                  <TableCell>Formulário</TableCell>
                  <TableCell>Competência</TableCell>
                  <TableCell>Respondente</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Criado / Enviado</TableCell>
                  <TableCell align="center">
                    <Tooltip title="Anexos">
                      <AttachFileIcon fontSize="small" />
                    </Tooltip>
                  </TableCell>
                  <TableCell padding="checkbox" />
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((s) => {
                  const podeExcluir = isAdmin || STATUS_EXCLUIVEIS.has(s.status);
                  return (
                    <TableRow
                      key={s.id}
                      hover
                      sx={{ cursor: "pointer" }}
                      onClick={() => navigate(`/submissoes/${s.id}`)}
                    >
                      <TableCell sx={{ fontFamily: "monospace", whiteSpace: "nowrap" }}>
                        {s.protocolo}
                      </TableCell>
                      <TableCell>
                        {s.municipio.nome}
                        <Typography component="span" variant="caption" color="text.secondary">
                          {" "}
                          ({s.municipio.id})
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {s.formularioVersao.formulario.nome}{" "}
                        <Typography component="span" variant="caption" color="text.secondary">
                          v{s.formularioVersao.versao}
                        </Typography>
                      </TableCell>
                      <TableCell>{s.competencia?.nome ?? "—"}</TableCell>
                      <TableCell>{s.nomeRespondente}</TableCell>
                      <TableCell>
                        <Chip
                          label={LABEL_STATUS[s.status] ?? s.status}
                          color={COR_STATUS[s.status] ?? "default"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(s.criadoEm).toLocaleDateString("pt-BR")}
                          {s.enviadoEm && (
                            <>
                              {" · env. "}
                              {new Date(s.enviadoEm).toLocaleDateString("pt-BR")}
                            </>
                          )}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">{s._count?.anexos ?? 0}</TableCell>
                      <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                        {podeExcluir && (
                          <Tooltip title="Excluir submissão">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setExcluindo(s);
                                setErroExclusao(null);
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={data?.total ?? 0}
            page={pagina}
            onPageChange={(_, p) => setPagina(p)}
            rowsPerPage={porPagina}
            onRowsPerPageChange={(e) => setPorPagina(parseInt(e.target.value, 10))}
            rowsPerPageOptions={[10, 25, 50, 100]}
            labelRowsPerPage="Por página"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
          />
        </Paper>
      )}

      <Dialog
        open={!!excluindo}
        onClose={() => {
          setExcluindo(null);
          setErroExclusao(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Excluir submissão?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Excluir a submissão do formulário{" "}
            <strong>{excluindo?.formularioVersao.formulario.nome}</strong> do município{" "}
            <strong>{excluindo?.municipio.nome}</strong>? Esta ação não pode ser desfeita.
          </DialogContentText>
          {erroExclusao && <Alert severity="error" sx={{ mt: 2 }}>{erroExclusao}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setExcluindo(null);
              setErroExclusao(null);
            }}
          >
            Cancelar
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={mutarExcluir.isPending}
            onClick={() => excluindo && mutarExcluir.mutate(excluindo.id)}
          >
            {mutarExcluir.isPending ? <CircularProgress size={18} color="inherit" /> : "Excluir"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
