import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import { useAuth } from "../../lib/auth-context";
import { QUERY_KEYS } from "../../shared/constants";
import { MunicipiosService } from "./services/municipios.service";

export default function MunicipioDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { usuario } = useAuth();

  const podeGerenciar = usuario?.permissoes.includes("municipios.gerenciar") ?? false;

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.MUNICIPIOS, id],
    queryFn: () => MunicipiosService.buscar(id!),
    enabled: !!id,
  });

  const [coordenadorNome, setCoordenadorNome] = useState<string>("");
  const [telefone, setTelefone] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [inicializado, setInicializado] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (data && !inicializado) {
    setCoordenadorNome(data.compdec?.coordenadorNome ?? "");
    setTelefone(data.compdec?.telefone ?? "");
    setEmail(data.compdec?.email ?? "");
    setInicializado(true);
  }

  const mutation = useMutation({
    mutationFn: () =>
      MunicipiosService.atualizarCompdec(id!, { coordenadorNome, telefone, email }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QUERY_KEYS.MUNICIPIOS] });
      setSucesso(true);
      setErro(null);
      setTimeout(() => setSucesso(false), 3000);
    },
    onError: (e: Error) => {
      setErro(e.message);
      setSucesso(false);
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!data) {
    return (
      <Alert severity="error">Município não encontrado.</Alert>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/municipios")}
          variant="text"
        >
          Municípios
        </Button>
        <Typography variant="h5">{data.nome}</Typography>
        <Typography variant="body2" color="text.secondary">
          {data.uf.sigla} — {data.regional?.nome ?? "Sem regional"}
        </Typography>
      </Stack>

      {sucesso && (
        <Alert severity="success">Dados da COMPDEC atualizados com sucesso.</Alert>
      )}
      {erro && <Alert severity="error">{erro}</Alert>}

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 3 }}>
            Dados da COMPDEC
          </Typography>

          <Stack spacing={2} sx={{ maxWidth: 480 }}>
            <TextField
              label="Nome do Coordenador"
              fullWidth
              size="small"
              value={coordenadorNome}
              onChange={(e) => setCoordenadorNome(e.target.value)}
              disabled={!podeGerenciar}
            />
            <TextField
              label="Telefone"
              fullWidth
              size="small"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              disabled={!podeGerenciar}
              placeholder="(31) 99999-0000"
            />
            <TextField
              label="E-mail"
              type="email"
              fullWidth
              size="small"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!podeGerenciar}
              placeholder="coordenador@prefeitura.mg.gov.br"
            />

            {podeGerenciar && (
              <Box>
                <Button
                  variant="contained"
                  startIcon={
                    mutation.isPending ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <SaveIcon />
                    )
                  }
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate()}
                >
                  Salvar
                </Button>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Identificação
          </Typography>
          <Stack spacing={0.5}>
            <Typography variant="body2">
              <strong>Código IBGE:</strong> {data.id}
            </Typography>
            <Typography variant="body2">
              <strong>Estado:</strong> {data.uf.nome} ({data.uf.sigla})
            </Typography>
            {data.regional && (
              <Typography variant="body2">
                <strong>Regional (REDEC):</strong> {data.regional.nome}
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
