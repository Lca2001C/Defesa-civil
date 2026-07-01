import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Chip,
  CircularProgress,
  Collapse,
  FormControl,
  IconButton,
  InputLabel,
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
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { QUERY_KEYS } from "../../shared/constants";
import { AuditoriaService } from "./services/auditoria.service";
import type { LogAuditoria } from "./types";

const ENTIDADES = ["", "Submissao", "Usuario", "Formulario", "Competencia", "Compdec"];

function LinhaLog({ log }: { log: LogAuditoria }) {
  const [expandido, setExpandido] = useState(false);
  const temDetalhes = log.antes || log.depois;

  return (
    <>
      <TableRow hover>
        <TableCell>
          <Typography variant="caption" color="text.secondary">
            {new Date(log.criadoEm).toLocaleString("pt-BR")}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.secondary">
            {log.ator?.nome ?? log.ator?.email ?? "Sistema"}
          </Typography>
        </TableCell>
        <TableCell>
          <Chip label={log.acao} size="small" variant="outlined" />
        </TableCell>
        <TableCell>
          <Typography variant="body2">{log.entidade}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
            {log.entidadeId ?? "—"}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="caption" color="text.secondary">
            {log.ip ?? "—"}
          </Typography>
        </TableCell>
        <TableCell align="center">
          {temDetalhes && (
            <IconButton size="small" onClick={() => setExpandido((v) => !v)}>
              {expandido ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          )}
        </TableCell>
      </TableRow>
      {temDetalhes && (
        <TableRow>
          <TableCell colSpan={7} sx={{ py: 0 }}>
            <Collapse in={expandido}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ p: 2 }}>
                {log.antes && (
                  <Box flex={1} sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                      Antes
                    </Typography>
                    <Box
                      component="pre"
                      sx={{
                        fontSize: "0.7rem",
                        fontFamily: "monospace",
                        bgcolor: "background.default",
                        p: 1,
                        borderRadius: 1,
                        overflow: "auto",
                        maxHeight: 200,
                      }}
                    >
                      {JSON.stringify(log.antes, null, 2)}
                    </Box>
                  </Box>
                )}
                {log.depois && (
                  <Box flex={1} sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                      Depois
                    </Typography>
                    <Box
                      component="pre"
                      sx={{
                        fontSize: "0.7rem",
                        fontFamily: "monospace",
                        bgcolor: "background.default",
                        p: 1,
                        borderRadius: 1,
                        overflow: "auto",
                        maxHeight: 200,
                      }}
                    >
                      {JSON.stringify(log.depois, null, 2)}
                    </Box>
                  </Box>
                )}
              </Stack>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function AuditoriaTab() {
  const [entidade, setEntidade] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.AUDITORIA, entidade],
    queryFn: () => AuditoriaService.listar(entidade || undefined),
  });

  const logs = data?.items ?? [];

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} spacing={2}>
        <FormControl size="small" sx={{ width: { xs: "100%", sm: 200 } }}>
          <InputLabel>Filtrar por entidade</InputLabel>
          <Select
            label="Filtrar por entidade"
            value={entidade}
            onChange={(e) => setEntidade(e.target.value)}
          >
            {ENTIDADES.map((e) => (
              <MenuItem key={e} value={e}>
                {e || "Todas"}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Data/Hora</TableCell>
              <TableCell>Ator</TableCell>
              <TableCell>Ação</TableCell>
              <TableCell>Entidade</TableCell>
              <TableCell>ID</TableCell>
              <TableCell>IP</TableCell>
              <TableCell align="center">Detalhes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Nenhum log encontrado
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => <LinhaLog key={log.id} log={log} />)
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" color="text.secondary">
        {data?.total ?? 0} registro{(data?.total ?? 0) !== 1 ? "s" : ""}
      </Typography>
    </Stack>
  );
}
