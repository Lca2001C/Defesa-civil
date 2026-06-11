import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { api, ApiError } from "../../lib/api";
import type { SchemaFormulario } from "@dcmg/contracts";

// ---- tipos ----

interface FormularioVersaoOpcao {
  id: string;
  versao: number;
  formulario: { id: string; nome: string };
}

interface CompetenciaOpcao {
  id: string;
  nome: string;
  status: string;
}

interface Lote {
  id: string;
  status: string;
  totalLinhas: number;
  linhasValidas: number;
  linhasComErro: number;
  erros: { id: string; linha: number; mensagem: string }[];
}

const PASSOS = ["Arquivo", "Configurar", "Processar"];

const COR_STATUS: Record<string, "default" | "warning" | "success" | "error" | "info"> = {
  PENDENTE: "default",
  PROCESSANDO: "info",
  CONCLUIDA: "success",
  CONCLUIDA_COM_ERROS: "warning",
  FALHOU: "error",
};

// ---- componente ----

export default function ImportacaoPage() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [passo, setPasso] = useState(0);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [formularioVersaoId, setFormularioVersaoId] = useState("");
  const [competenciaId, setCompetenciaId] = useState("");
  const [municipioId, setMunicipioId] = useState("");
  const [schemaPreview, setSchemaPreview] = useState<SchemaFormulario | null>(null);
  const [loteId, setLoteId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Versões publicadas
  const { data: versoes, isLoading: carregandoVersoes } = useQuery({
    queryKey: ["formularios-versoes-publicadas"],
    queryFn: () => api.get<FormularioVersaoOpcao[]>("/formularios/versoes/publicadas"),
  });

  // Competências abertas
  const { data: competencias, isLoading: carregandoComp } = useQuery({
    queryKey: ["competencias-abertas"],
    queryFn: () => api.get<{ items: CompetenciaOpcao[] }>("/competencias?status=ABERTA&porPagina=50"),
  });

  // Status do lote (polling a cada 3s enquanto processando)
  const { data: lote } = useQuery({
    queryKey: ["lote", loteId],
    queryFn: () => api.get<Lote>(`/importacoes/${loteId}`),
    enabled: !!loteId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "PENDENTE" || status === "PROCESSANDO" ? 3000 : false;
    },
  });

  // Mutation: parse-template (Fluxo A — preview)
  const parseTemplate = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("arquivo", file);
      return fetch("/api/excel/parse-template", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("dcmg_access_token") ?? ""}`,
        },
        body: form,
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.message ?? "Erro ao analisar planilha");
        return json as SchemaFormulario;
      });
    },
    onSuccess: (schema) => {
      setSchemaPreview(schema);
      setPasso(1);
      setErro(null);
    },
    onError: (e) => setErro((e as Error).message),
  });

  // Mutation: criar importação (Fluxo B)
  const criarImportacao = useMutation({
    mutationFn: async () => {
      if (!arquivo) throw new Error("Arquivo não selecionado.");
      const form = new FormData();
      form.append("arquivo", arquivo);
      form.append("formularioVersaoId", formularioVersaoId);
      form.append("competenciaId", competenciaId);
      if (municipioId) form.append("municipioId", municipioId);
      return fetch("/api/importacoes", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("dcmg_access_token") ?? ""}`,
        },
        body: form,
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.message ?? "Erro ao criar importação");
        return json as { id: string };
      });
    },
    onSuccess: (lote) => {
      setLoteId(lote.id);
      setPasso(2);
      setErro(null);
      qc.invalidateQueries({ queryKey: ["lote", lote.id] });
    },
    onError: (e: unknown) => {
      setErro(e instanceof ApiError ? e.message : (e as Error).message);
    },
  });

  const selecionarArquivo = (file: File) => {
    setArquivo(file);
    setSchemaPreview(null);
    parseTemplate.mutate(file);
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Importação via planilha
      </Typography>

      <Stepper activeStep={passo} sx={{ mb: 4 }}>
        {PASSOS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      {/* Passo 0 — Upload do arquivo */}
      {passo === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Selecionar planilha (.xlsx)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Envie uma planilha Excel. Se incluir uma aba "Definições" com as colunas{" "}
              <em>chave, rótulo, tipo, obrigatório, opções, ajuda</em>, o sistema
              importa o schema diretamente. Caso contrário, infere os campos pelos
              cabeçalhos da primeira aba.
            </Typography>

            <Box
              sx={{
                border: "2px dashed",
                borderColor: "divider",
                borderRadius: 2,
                p: 4,
                textAlign: "center",
                cursor: "pointer",
                "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
              }}
              onClick={() => inputRef.current?.click()}
            >
              {parseTemplate.isPending ? (
                <CircularProgress size={40} />
              ) : (
                <>
                  <UploadFileIcon sx={{ fontSize: 48, color: "text.secondary", mb: 1 }} />
                  <Typography>Clique ou arraste o arquivo aqui</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Formatos aceitos: .xlsx, .xls
                  </Typography>
                </>
              )}
            </Box>

            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) selecionarArquivo(file);
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Passo 1 — Configurar e conferir schema */}
      {passo === 1 && schemaPreview && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Preview do schema detectado
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Arquivo: <strong>{arquivo?.name}</strong> ·{" "}
                {schemaPreview.secoes.reduce((a, s) => a + s.campos.length, 0)} campo(s) em{" "}
                {schemaPreview.secoes.length} seção(ões)
              </Typography>
              {schemaPreview.secoes.map((secao) => (
                <Box key={secao.chave} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">{secao.titulo}</Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                    {secao.campos.map((c) => (
                      <Chip
                        key={c.chave}
                        label={`${c.rotulo} (${c.tipo})`}
                        size="small"
                        variant="outlined"
                        color={c.obrigatorio ? "primary" : "default"}
                      />
                    ))}
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Configurar importação (Fluxo B)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Selecione a versão publicada do formulário e a competência destino.
              </Typography>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <TextField
                  select
                  label="Versão do formulário"
                  value={formularioVersaoId}
                  onChange={(e) => setFormularioVersaoId(e.target.value)}
                  SelectProps={{ native: true }}
                  size="small"
                  disabled={carregandoVersoes}
                >
                  <option value="">— selecione —</option>
                  {versoes?.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.formulario.nome} — v{v.versao}
                    </option>
                  ))}
                </TextField>

                <TextField
                  select
                  label="Competência (ABERTA)"
                  value={competenciaId}
                  onChange={(e) => setCompetenciaId(e.target.value)}
                  SelectProps={{ native: true }}
                  size="small"
                  disabled={carregandoComp}
                >
                  <option value="">— selecione —</option>
                  {competencias?.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </TextField>

                <TextField
                  label="Código IBGE do município (opcional)"
                  helperText="Preencha se todos os registros pertencem ao mesmo município"
                  value={municipioId}
                  onChange={(e) => setMunicipioId(e.target.value)}
                  size="small"
                  type="number"
                />
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setPasso(0);
                    setArquivo(null);
                    setSchemaPreview(null);
                  }}
                >
                  Trocar arquivo
                </Button>
                <Button
                  variant="contained"
                  disabled={!formularioVersaoId || !competenciaId || criarImportacao.isPending}
                  onClick={() => criarImportacao.mutate()}
                >
                  {criarImportacao.isPending ? <CircularProgress size={20} color="inherit" /> : "Iniciar importação"}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Passo 2 — Monitorar processamento */}
      {passo === 2 && (
        <Card>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
              <Typography variant="h6">Processando lote</Typography>
              {lote && (
                <Chip
                  label={lote.status}
                  color={COR_STATUS[lote.status] ?? "default"}
                  icon={lote.status === "CONCLUIDA" ? <CheckCircleIcon /> : undefined}
                />
              )}
              {(!lote || lote.status === "PENDENTE" || lote.status === "PROCESSANDO") && (
                <CircularProgress size={22} />
              )}
            </Box>

            {lote && (
              <Box sx={{ display: "flex", gap: 3, mb: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Total
                  </Typography>
                  <Typography variant="h6">{lote.totalLinhas}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="success.main">
                    Válidas
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    {lote.linhasValidas}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="error.main">
                    Com erro
                  </Typography>
                  <Typography variant="h6" color="error.main">
                    {lote.linhasComErro}
                  </Typography>
                </Box>
              </Box>
            )}

            {lote && lote.erros.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Relatório de erros ({lote.erros.length} primeiros)
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {lote.erros.map((e) => (
                    <Alert key={e.id} severity="error" sx={{ py: 0 }}>
                      Linha {e.linha}: {e.mensagem}
                    </Alert>
                  ))}
                </Box>
              </>
            )}

            {lote &&
              (lote.status === "CONCLUIDA" || lote.status === "CONCLUIDA_COM_ERROS") && (
                <Button
                  sx={{ mt: 2 }}
                  variant="outlined"
                  onClick={() => {
                    setPasso(0);
                    setArquivo(null);
                    setSchemaPreview(null);
                    setLoteId(null);
                    setFormularioVersaoId("");
                    setCompetenciaId("");
                    setMunicipioId("");
                  }}
                >
                  Nova importação
                </Button>
              )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
