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
  DialogContentText,
  DialogTitle,
  FormControl,
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
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { mascaraCpf } from "../../shared/utils";
import UsuarioFormDialog from "./UsuarioFormDialog";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  cpf: string;
  cargo: string | null;
  escopo: string;
  ativo: boolean;
  perfil: { nome: string; codigo: string; nivel: number };
  municipio: { nome: string } | null;
  regional: { nome: string } | null;
}

export default function UsuariosTab() {
  const { usuario: usuarioAtual } = useAuth();
  const qc = useQueryClient();
  const [ativoFiltro, setAtivoFiltro] = useState<string>("true");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [excluindoUsuario, setExcluindoUsuario] = useState<Usuario | null>(null);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const { data: usuarios = [], isLoading } = useQuery<Usuario[]>({
    queryKey: ["usuarios", ativoFiltro],
    queryFn: () =>
      api.get<Usuario[]>(`/usuarios?ativo=${ativoFiltro}`),
  });

  const mutarStatus = useMutation({
    mutationFn: ({ id, acao }: { id: string; acao: "ativar" | "desativar" }) =>
      api.patch(`/usuarios/${id}/${acao}`, {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["usuarios"] }),
  });

  const mutarExcluir = useMutation({
    mutationFn: (id: string) => api.delete(`/usuarios/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["usuarios"] });
      setExcluindoUsuario(null);
      setErroExclusao(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao excluir usuário.";
      setErroExclusao(msg);
    },
  });

  function abrirCriar() {
    setEditandoId(null);
    setDialogOpen(true);
  }

  function abrirEditar(id: string) {
    setEditandoId(id);
    setDialogOpen(true);
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select
            label="Status"
            value={ativoFiltro}
            onChange={(e) => setAtivoFiltro(e.target.value)}
          >
            <MenuItem value="true">Ativos</MenuItem>
            <MenuItem value="false">Inativos</MenuItem>
          </Select>
        </FormControl>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={abrirCriar}
        >
          Novo usuário
        </Button>
      </Stack>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>E-mail</TableCell>
              <TableCell>CPF</TableCell>
              <TableCell>Perfil</TableCell>
              <TableCell>Escopo</TableCell>
              <TableCell>Município / Regional</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : usuarios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Nenhum usuário encontrado
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              usuarios.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {u.nome}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {u.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                      {mascaraCpf(u.cpf)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={u.perfil.nome}
                      size="small"
                      variant="outlined"
                      color={u.perfil.codigo === "COORDENADOR_COMPDEC" ? "warning" : "default"}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{u.escopo}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {u.municipio?.nome ?? u.regional?.nome ?? "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={u.ativo ? "Ativo" : "Inativo"}
                      size="small"
                      color={u.ativo ? "success" : "default"}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={0.5} justifyContent="center">
                      <Tooltip title="Editar">
                        <Button size="small" onClick={() => abrirEditar(u.id)}>
                          <EditIcon fontSize="small" />
                        </Button>
                      </Tooltip>
                      {u.id !== usuarioAtual?.sub && (
                        <>
                          <Tooltip title={u.ativo ? "Desativar" : "Ativar"}>
                            <Button
                              size="small"
                              color={u.ativo ? "error" : "success"}
                              disabled={mutarStatus.isPending}
                              onClick={() =>
                                mutarStatus.mutate({
                                  id: u.id,
                                  acao: u.ativo ? "desativar" : "ativar",
                                })
                              }
                            >
                              {u.ativo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                            </Button>
                          </Tooltip>
                          <Tooltip title="Excluir permanentemente">
                            <Button
                              size="small"
                              color="error"
                              onClick={() => { setExcluindoUsuario(u); setErroExclusao(null); }}
                            >
                              <DeleteIcon fontSize="small" />
                            </Button>
                          </Tooltip>
                        </>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box>
        <Typography variant="caption" color="text.secondary">
          {usuarios.length} usuário{usuarios.length !== 1 ? "s" : ""} encontrado
          {usuarios.length !== 1 ? "s" : ""}
        </Typography>
      </Box>

      <UsuarioFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        usuarioId={editandoId}
      />

      <Dialog
        open={!!excluindoUsuario}
        onClose={() => { setExcluindoUsuario(null); setErroExclusao(null); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Excluir usuário?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Você está prestes a excluir permanentemente o usuário{" "}
            <strong>{excluindoUsuario?.nome}</strong> ({excluindoUsuario?.email}).
            Esta ação não pode ser desfeita.
          </DialogContentText>
          {erroExclusao && (
            <Alert severity="error" sx={{ mt: 2 }}>{erroExclusao}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setExcluindoUsuario(null); setErroExclusao(null); }}>
            Cancelar
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={mutarExcluir.isPending}
            onClick={() => excluindoUsuario && mutarExcluir.mutate(excluindoUsuario.id)}
          >
            {mutarExcluir.isPending ? <CircularProgress size={18} color="inherit" /> : "Excluir"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
