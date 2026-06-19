import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from "@mui/material";
import { ApiError } from "../../lib/api";
import { QUERY_KEYS } from "../../shared/constants";
import { UsuariosService } from "./services/usuarios.service";

const PERFIS = [
  { codigo: "SUPER_ADMIN", label: "Super Administrador" },
  { codigo: "GESTOR_ESTADUAL", label: "Gestor Estadual" },
  { codigo: "COORDENADOR_REGIONAL", label: "Coordenador Regional" },
  { codigo: "ADMIN_MUNICIPAL", label: "Administrador Municipal" },
  { codigo: "OPERADOR_MUNICIPAL", label: "Operador Municipal" },
  { codigo: "COORDENADOR_COMPDEC", label: "Coordenador COMPDEC (aguardando aprovação)" },
  { codigo: "CONSULTA", label: "Consulta" },
];

const ESCOPOS = [
  { value: "ESTADUAL", label: "Estadual" },
  { value: "REGIONAL", label: "Regional" },
  { value: "MUNICIPAL", label: "Municipal" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  usuarioId?: string | null;
}

export default function UsuarioFormDialog({ open, onClose, usuarioId }: Props) {
  const qc = useQueryClient();
  const isEdicao = !!usuarioId;

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [cargo, setCargo] = useState("");
  const [telefone, setTelefone] = useState("");
  const [perfilCodigo, setPerfilCodigo] = useState("OPERADOR_MUNICIPAL");
  const [escopo, setEscopo] = useState("MUNICIPAL");
  const [municipioId, setMunicipioId] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setNome(""); setCpf(""); setEmail(""); setSenha("");
      setCargo(""); setTelefone(""); setPerfilCodigo("OPERADOR_MUNICIPAL");
      setEscopo("MUNICIPAL"); setMunicipioId(""); setErro(null);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => {
      if (isEdicao) {
        return UsuariosService.atualizar(usuarioId!, { nome, cargo, telefone, perfilCodigo });
      }
      return UsuariosService.criar({
        nome, cpf, email, senha, cargo, telefone, perfilCodigo, escopo,
        municipioId: escopo === "MUNICIPAL" && municipioId ? Number(municipioId) : undefined,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QUERY_KEYS.USUARIOS] });
      onClose();
    },
    onError: (e) => {
      setErro(e instanceof ApiError ? e.message : "Erro ao salvar usuário.");
    },
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isEdicao ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {erro && <Alert severity="error">{erro}</Alert>}
          <TextField label="Nome" fullWidth size="small" value={nome} onChange={(e) => setNome(e.target.value)} required />
          {!isEdicao && (
            <>
              <TextField label="CPF (somente números)" fullWidth size="small" value={cpf} onChange={(e) => setCpf(e.target.value)} required inputProps={{ maxLength: 11 }} />
              <TextField label="E-mail" type="email" fullWidth size="small" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <TextField label="Senha" type="password" fullWidth size="small" value={senha} onChange={(e) => setSenha(e.target.value)} required helperText="Mínimo 8 caracteres" />
            </>
          )}
          <TextField label="Cargo" fullWidth size="small" value={cargo} onChange={(e) => setCargo(e.target.value)} />
          <TextField label="Telefone" fullWidth size="small" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          <FormControl fullWidth size="small">
            <InputLabel>Perfil</InputLabel>
            <Select label="Perfil" value={perfilCodigo} onChange={(e) => setPerfilCodigo(e.target.value)}>
              {PERFIS.map((p) => <MenuItem key={p.codigo} value={p.codigo}>{p.label}</MenuItem>)}
            </Select>
          </FormControl>
          {!isEdicao && (
            <FormControl fullWidth size="small">
              <InputLabel>Escopo</InputLabel>
              <Select label="Escopo" value={escopo} onChange={(e) => setEscopo(e.target.value)}>
                {ESCOPOS.map((e) => <MenuItem key={e.value} value={e.value}>{e.label}</MenuItem>)}
              </Select>
            </FormControl>
          )}
          {!isEdicao && escopo === "MUNICIPAL" && (
            <TextField label="Código IBGE do Município" fullWidth size="small" value={municipioId} onChange={(e) => setMunicipioId(e.target.value)} helperText="Ex.: 3106200 (Belo Horizonte)" />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !nome || (!isEdicao && (!cpf || !email || !senha))}
          startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {isEdicao ? "Salvar" : "Criar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
