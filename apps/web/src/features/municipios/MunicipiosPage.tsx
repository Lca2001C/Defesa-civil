import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import { useAuth } from "../../lib/auth-context";
import { QUERY_KEYS } from "../../shared/constants";
import { MunicipiosService } from "./services/municipios.service";

export default function MunicipiosPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [nomeFiltro, setNomeFiltro] = useState("");
  const [nomeDebounced, setNomeDebounced] = useState("");

  const podeGerenciar = usuario?.permissoes.includes("municipios.gerenciar") ?? false;

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.MUNICIPIOS, nomeDebounced],
    queryFn: () => MunicipiosService.listar(nomeDebounced || undefined),
  });

  function handleNomeChange(valor: string) {
    setNomeFiltro(valor);
    clearTimeout((window as unknown as { _mftimer?: ReturnType<typeof setTimeout> })._mftimer);
    (window as unknown as { _mftimer?: ReturnType<typeof setTimeout> })._mftimer = setTimeout(
      () => setNomeDebounced(valor),
      350,
    );
  }

  const municipios = data?.items ?? [];

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5">Municípios</Typography>
        <Typography variant="body2" color="text.secondary">
          853 municípios de Minas Gerais — dados das COMPDECs
        </Typography>
      </Box>

      {/* filtro */}
      <Card>
        <CardContent>
          <TextField
            size="small"
            placeholder="Buscar município..."
            value={nomeFiltro}
            onChange={(e) => handleNomeChange(e.target.value)}
            sx={{ width: { xs: "100%", sm: 300 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </CardContent>
      </Card>

      {/* tabela */}
      <Card>
        <TableContainer>
          <Table size="small" sx={{ minWidth: { xs: 0, md: 900 } }}>
            <TableHead>
              <TableRow>
                <TableCell>Código IBGE</TableCell>
                <TableCell>Nome</TableCell>
                <TableCell>Regional (REDEC)</TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Coordenador</TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Telefone</TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>E-mail</TableCell>
                <TableCell>COMPDEC</TableCell>
                {podeGerenciar && <TableCell align="center">Ação</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : municipios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      Nenhum município encontrado
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                municipios.map((m) => (
                  <TableRow key={m.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                        {m.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {m.nome}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {m.regional?.nome ?? "—"}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                      <Typography variant="body2">
                        {m.compdec?.coordenadorNome ?? "—"}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                      <Typography variant="body2" color="text.secondary">
                        {m.compdec?.telefone ?? "—"}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                      <Typography variant="body2" color="text.secondary">
                        {m.compdec?.email ?? "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {m.compdec?.coordenadorNome &&
                      m.compdec.coordenadorNome !== "A preencher" ? (
                        <Chip label="Cadastrada" size="small" color="success" />
                      ) : (
                        <Chip label="Sem dados" size="small" color="default" />
                      )}
                    </TableCell>
                    {podeGerenciar && (
                      <TableCell align="center">
                        <Button
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => navigate(`/municipios/${m.id}`)}
                        >
                          Editar
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {data && (
          <Box sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {data.total} município{data.total !== 1 ? "s" : ""} encontrado
              {data.total !== 1 ? "s" : ""}
            </Typography>
          </Box>
        )}
      </Card>
    </Stack>
  );
}
