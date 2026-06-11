import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { DynamicForm } from "../../components/dynamic-form";
import type { SchemaFormulario } from "@dcmg/contracts";

interface VersaoOpcao {
  id: string;
  versao: number;
  formulario: { id: string; nome: string };
  competencia: { id: string; nome: string } | null;
}

interface VersaoCompleta {
  id: string;
  versao: number;
  schema: SchemaFormulario;
  competenciaId: string | null;
  formulario: { nome: string };
}

const PASSOS = ["Selecionar formulário", "Preencher resposta", "Confirmar"];

export default function SubmissaoNova() {
  const navigate = useNavigate();
  const [passo, setPasso] = useState(0);
  const [versaoId, setVersaoId] = useState("");
  const [municipioId, setMunicipioId] = useState("");
  const [dados, setDados] = useState<Record<string, unknown>>({});
  const [erro, setErro] = useState<string | null>(null);

  const { data: versoes, isLoading: carregandoVersoes } = useQuery({
    queryKey: ["versoes-publicadas"],
    queryFn: () => api.get<VersaoOpcao[]>("/formularios/versoes/publicadas"),
  });

  const { data: versao } = useQuery({
    queryKey: ["versao", versaoId],
    queryFn: () =>
      versoes
        ?.flatMap((v) => v)
        .find((v) => v.id === versaoId)
        ? api.get<VersaoCompleta>(`/formularios/${versoes!.find((v) => v.id === versaoId)!.formulario.id}/versoes/${versaoId}`)
        : null,
    enabled: !!versaoId && !!versoes,
  });

  const criarMutation = useMutation<{ id: string; protocolo: string }, Error, { enviar: boolean }>({
    mutationFn: (payload) =>
      api.post("/submissoes", {
        formularioVersaoId: versaoId,
        competenciaId:
          versoes?.find((v) => v.id === versaoId)?.competencia?.id ?? "",
        municipioId: parseInt(municipioId, 10),
        dados,
        enviarImediatamente: payload.enviar,
      }),
    onSuccess: (sub: { id: string; protocolo: string }) => {
      navigate(`/submissoes/${sub.id}`);
    },
    onError: (e: unknown) => setErro((e as Error).message),
  });

  const versaoSelecionada = versoes?.find((v) => v.id === versaoId);

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} sx={{ mb: 2 }} onClick={() => navigate("/submissoes")}>
        Voltar
      </Button>

      <Typography variant="h5" sx={{ mb: 3 }}>
        Nova resposta
      </Typography>

      <Stepper activeStep={passo} sx={{ mb: 4 }}>
        {PASSOS.map((l) => (
          <Step key={l}>
            <StepLabel>{l}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      {/* Passo 0 — Selecionar formulário */}
      {passo === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Selecionar formulário e município
            </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
              <TextField
                select
                label="Formulário / Versão"
                value={versaoId}
                onChange={(e) => setVersaoId(e.target.value)}
                SelectProps={{ native: true }}
                size="small"
                disabled={carregandoVersoes}
              >
                <option value="">— selecione —</option>
                {versoes?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.formulario.nome} v{v.versao}
                    {v.competencia ? ` · ${v.competencia.nome}` : ""}
                  </option>
                ))}
              </TextField>

              <TextField
                label="Código IBGE do município"
                value={municipioId}
                onChange={(e) => setMunicipioId(e.target.value)}
                size="small"
                type="number"
                helperText="Ex.: 3106200 para Belo Horizonte"
              />

              <Button
                variant="contained"
                disabled={!versaoId || !municipioId}
                onClick={() => setPasso(1)}
              >
                Avançar
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Passo 1 — Preencher formulário dinâmico */}
      {passo === 1 && versao?.schema && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {versaoSelecionada?.formulario.nome}
            </Typography>
            <DynamicForm
              schema={versao.schema}
              onSubmit={(d) => {
                setDados(d);
                setPasso(2);
              }}
            />
          </CardContent>
        </Card>
      )}

      {passo === 1 && !versao && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Passo 2 — Confirmar e enviar */}
      {passo === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Confirmar envio
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Formulário: <strong>{versaoSelecionada?.formulario.nome}</strong>
              <br />
              Município (IBGE): <strong>{municipioId}</strong>
              <br />
              Campos preenchidos: <strong>{Object.keys(dados).length}</strong>
            </Typography>

            <Box sx={{ display: "flex", gap: 1 }}>
              <Button variant="outlined" onClick={() => setPasso(1)}>
                Revisar
              </Button>
              <Button
                variant="outlined"
                disabled={criarMutation.isPending}
                onClick={() => criarMutation.mutate({ enviar: false })}
              >
                Salvar rascunho
              </Button>
              <Button
                variant="contained"
                disabled={criarMutation.isPending}
                onClick={() => criarMutation.mutate({ enviar: true })}
              >
                {criarMutation.isPending ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  "Enviar resposta"
                )}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
