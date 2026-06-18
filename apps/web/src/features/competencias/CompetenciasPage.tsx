import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EventIcon from "@mui/icons-material/Event";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { QUERY_KEYS } from "../../shared/constants";
import { CompetenciasService } from "./services/competencias.service";

const COR_STATUS: Record<string, "default" | "success" | "warning"> = {
  PLANEJADA: "warning",
  ABERTA: "success",
  ENCERRADA: "default",
};

const anoAtual = new Date().getFullYear();

export default function CompetenciasPage() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  const podeGerenciar = usuario?.permissoes.includes("competencias.gerenciar") ?? false;

  const [dialogAberto, setDialogAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "",
    ano: String(anoAtual),
    dataInicio: `${anoAtual}-01-01`,
    dataFim: `${anoAtual}-12-31`,
  });

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.COMPETENCIAS],
    queryFn: () => CompetenciasService.listar(),
  });

  const invalida = () => qc.invalidateQueries({ queryKey: [QUERY_KEYS.COMPETENCIAS] });

  const criar = useMutation({
    mutationFn: () =>
      CompetenciasService.criar({
        nome: form.nome,
        ano: Number(form.ano),
        dataInicio: form.dataInicio,
        dataFim: form.dataFim,
      }),
    onSuccess: () => {
      setDialogAberto(false);
      setErro(null);
      setForm({ nome: "", ano: String(anoAtual), dataInicio: `${anoAtual}-01-01`, dataFim: `${anoAtual}-12-31` });
      invalida();
    },
    onError: (e) => setErro(e instanceof ApiError ? e.message : "Erro ao criar competência."),
  });

  const abrir = useMutation({
    mutationFn: (id: string) => CompetenciasService.abrir(id),
    onSuccess: invalida,
    onError: (e) => setErro(e instanceof ApiError ? e.message : "Erro ao abrir competência."),
  });

  const encerrar = useMutation({
    mutationFn: (id: string) => CompetenciasService.encerrar(id),
    onSuccess: invalida,
    onError: (e) => setErro(e instanceof ApiError ? e.message : "Erro ao encerrar competência."),
  });

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h5">Competências</Typography>
          <Typography variant="body2" color="text.secondary">
            Ciclos de coleta. Publique formulários em competências ABERTAS.
          </Typography>
        </Box>
        {podeGerenciar && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogAberto(true)}>
            Nova competência
          </Button>
        )}
      </Box>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress />
        </Box>
      ) : data?.length === 0 ? (
        <Box sx={{ textAlign: "center", mt: 6, color: "text.secondary" }}>
          <EventIcon sx={{ fontSize: 56, mb: 1, opacity: 0.4 }} />
          <Typography>Nenhuma competência cadastrada.</Typography>
        </Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Ano</TableCell>
              <TableCell>Início</TableCell>
              <TableCell>Fim</TableCell>
              <TableCell>Status</TableCell>
              {podeGerenciar && <TableCell align="right">Ações</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell>{c.nome}</TableCell>
                <TableCell>{c.ano}</TableCell>
                <TableCell>{new Date(c.dataInicio).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>{new Date(c.dataFim).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>
                  <Chip label={c.status} size="small" color={COR_STATUS[c.status] ?? "default"} />
                </TableCell>
                {podeGerenciar && (
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      {c.status === "PLANEJADA" && (
                        <Button size="small" variant="outlined" onClick={() => abrir.mutate(c.id)}>
                          Abrir
                        </Button>
                      )}
                      {c.status === "ABERTA" && (
                        <Button size="small" variant="outlined" color="warning" onClick={() => encerrar.mutate(c.id)}>
                          Encerrar
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogAberto} onClose={() => setDialogAberto(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Nova competência</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nome"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              size="small"
              fullWidth
              required
            />
            <TextField
              label="Ano"
              type="number"
              value={form.ano}
              onChange={(e) => setForm((f) => ({ ...f, ano: e.target.value }))}
              size="small"
              fullWidth
            />
            <TextField
              label="Início"
              type="date"
              value={form.dataInicio}
              onChange={(e) => setForm((f) => ({ ...f, dataInicio: e.target.value }))}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Fim"
              type="date"
              value={form.dataFim}
              onChange={(e) => setForm((f) => ({ ...f, dataFim: e.target.value }))}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogAberto(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!form.nome || criar.isPending}
            onClick={() => criar.mutate()}
          >
            {criar.isPending ? <CircularProgress size={20} color="inherit" /> : "Criar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
