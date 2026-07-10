import {
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  TipoPergunta,
  VarianteInformativo,
  type OpcaoPergunta,
  type Pergunta,
  type RegraCondicional,
  OperadorCondicional,
  AcaoCondicional,
} from "@dcmg/contracts";
import {
  FONTES_AUTOMATICAS,
  TIPOS,
  TIPOS_COM_OPCOES,
  TIPOS_PROIBIDOS_EM_GRUPO,
  criarSubpergunta,
} from "./tipos";

const VALOR_OUTRO = "outro";

interface Props {
  pergunta: Pergunta;
  /** Outras perguntas do formulário (para configurar regras condicionais). */
  outras: Pergunta[];
  onChange: (p: Pergunta) => void;
  /** True quando esta é uma SUBPERGUNTA dentro de um grupo repetível. */
  emGrupo?: boolean;
}

export function PerguntaEditor({ pergunta, outras, onChange, emGrupo = false }: Props) {
  const set = (patch: Partial<Pergunta>) => onChange({ ...pergunta, ...patch });
  const temOpcoes = TIPOS_COM_OPCOES.includes(pergunta.tipo);
  const ehGrupo = pergunta.tipo === TipoPergunta.GRUPO;
  const ehLista = pergunta.tipo === TipoPergunta.LISTA_SUSPENSA;
  const temOutro = (pergunta.opcoes ?? []).some((o) => o.valor === VALOR_OUTRO);

  // Dentro de um grupo, os tipos GRUPO/UPLOAD/AUTOMATICO não são permitidos.
  const tiposDisponiveis = emGrupo
    ? TIPOS.filter((t) => !TIPOS_PROIBIDOS_EM_GRUPO.includes(t.tipo))
    : TIPOS;

  // Perguntas NUMERO (fora de grupos) elegíveis para controlar a quantidade.
  const perguntasNumero = outras.filter((p) => p.tipo === TipoPergunta.NUMERO);

  function setOpcao(i: number, patch: Partial<OpcaoPergunta>) {
    const opcoes = [...(pergunta.opcoes ?? [])];
    opcoes[i] = { ...opcoes[i]!, ...patch };
    set({ opcoes });
  }
  function addOpcao() {
    const n = (pergunta.opcoes?.length ?? 0) + 1;
    set({ opcoes: [...(pergunta.opcoes ?? []), { valor: `opcao_${n}`, rotulo: `Opção ${n}` }] });
  }
  function removerOpcao(i: number) {
    set({ opcoes: (pergunta.opcoes ?? []).filter((_, idx) => idx !== i) });
  }

  /**
   * Alterna a opção "Outro(s)". A pergunta de especificação obrigatória
   * (quando o usuário escolhe "Outro") é gerada automaticamente na IMPORTAÇÃO
   * via Excel; no builder, adicione um campo de texto condicional se precisar.
   */
  function toggleOutro(ativar: boolean) {
    const semOutro = (pergunta.opcoes ?? []).filter((o) => o.valor !== VALOR_OUTRO);
    set({
      opcoes: ativar ? [...semOutro, { valor: VALOR_OUTRO, rotulo: "Outro(s)" }] : semOutro,
    });
  }

  function addRegra() {
    const origem = outras[0];
    if (!origem) return;
    const regra: RegraCondicional = {
      origemCodigo: origem.codigo,
      operador: OperadorCondicional.IGUAL,
      valor: "",
      acao: AcaoCondicional.MOSTRAR,
    };
    set({ regras: [...(pergunta.regras ?? []), regra] });
  }
  function setRegra(i: number, patch: Partial<RegraCondicional>) {
    const regras = [...(pergunta.regras ?? [])];
    regras[i] = { ...regras[i]!, ...patch };
    set({ regras });
  }
  function removerRegra(i: number) {
    set({ regras: (pergunta.regras ?? []).filter((_, idx) => idx !== i) });
  }

  // ── Subperguntas do GRUPO ──────────────────────────────────────────────────
  function setSubpergunta(i: number, nova: Pergunta) {
    const perguntas = [...(pergunta.perguntas ?? [])];
    perguntas[i] = nova;
    set({ perguntas });
  }
  function addSubpergunta() {
    set({ perguntas: [...(pergunta.perguntas ?? []), criarSubpergunta()] });
  }
  function removerSubpergunta(i: number) {
    set({ perguntas: (pergunta.perguntas ?? []).filter((_, idx) => idx !== i) });
  }

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          label="Rótulo da pergunta"
          value={pergunta.rotulo}
          onChange={(e) => set({ rotulo: e.target.value })}
          fullWidth
          size="small"
        />
        <TextField
          select
          label="Tipo"
          value={pergunta.tipo}
          onChange={(e) => set({ tipo: e.target.value as TipoPergunta })}
          size="small"
          sx={{ width: { xs: "100%", sm: 180 }, minWidth: { sm: 180 } }}
        >
          {tiposDisponiveis.map((t) => (
            <MenuItem key={t.tipo} value={t.tipo}>
              {t.rotulo}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", sm: "center" }}
      >
        <TextField
          label="Código (chave)"
          value={pergunta.codigo}
          onChange={(e) => set({ codigo: e.target.value.replace(/\s+/g, "_").toLowerCase() })}
          size="small"
          helperText="Identificador único nas respostas"
          sx={{ flex: 1, minWidth: 0 }}
        />
        <TextField
          label="Texto de ajuda"
          value={pergunta.ajuda ?? ""}
          onChange={(e) => set({ ajuda: e.target.value })}
          size="small"
          multiline
          maxRows={4}
          sx={{ flex: 1, minWidth: 0 }}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={pergunta.obrigatorio}
              onChange={(e) => set({ obrigatorio: e.target.checked })}
              size="small"
            />
          }
          label="Obrigatória"
        />
      </Stack>

      {pergunta.tipo === TipoPergunta.AUTOMATICO && (
        <TextField
          select
          label="Fonte automática"
          value={pergunta.fonteAutomatica ?? ""}
          onChange={(e) => set({ fonteAutomatica: e.target.value as Pergunta["fonteAutomatica"] })}
          size="small"
          sx={{ width: "100%", maxWidth: 280 }}
        >
          {FONTES_AUTOMATICAS.map((f) => (
            <MenuItem key={f.fonte} value={f.fonte}>
              {f.rotulo}
            </MenuItem>
          ))}
        </TextField>
      )}

      {pergunta.tipo === TipoPergunta.INFORMATIVO && (
        <TextField
          select
          label="Aparência"
          value={pergunta.variante ?? VarianteInformativo.DESCRICAO}
          onChange={(e) => set({ variante: e.target.value as VarianteInformativo })}
          size="small"
          helperText="Componente visual (não é um campo de resposta). O texto vem do rótulo."
          sx={{ width: "100%", maxWidth: 280 }}
        >
          <MenuItem value={VarianteInformativo.TITULO}>Título</MenuItem>
          <MenuItem value={VarianteInformativo.DESCRICAO}>Descrição</MenuItem>
          <MenuItem value={VarianteInformativo.ALERTA}>Alerta</MenuItem>
        </TextField>
      )}

      {ehLista && (
        <FormControlLabel
          control={
            <Checkbox
              checked={!!pergunta.multipla}
              onChange={(e) => set({ multipla: e.target.checked })}
              size="small"
            />
          }
          label="Permitir selecionar mais de uma opção (múltipla seleção)"
        />
      )}

      {temOpcoes && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2" gutterBottom>
              Opções
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={temOutro}
                  onChange={(e) => toggleOutro(e.target.checked)}
                  size="small"
                />
              }
              label={'Incluir opção "Outro(s)"'}
            />
          </Stack>
          <Stack spacing={1}>
            {(pergunta.opcoes ?? []).map((o, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="center">
                <TextField
                  label="Rótulo"
                  value={o.rotulo}
                  onChange={(e) => {
                    const rotulo = e.target.value;
                    setOpcao(i, { rotulo, valor: rotulo.replace(/\s+/g, "_").toLowerCase() });
                  }}
                  size="small"
                  fullWidth
                  disabled={o.valor === VALOR_OUTRO}
                />
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => removerOpcao(i)}
                  disabled={o.valor === VALOR_OUTRO}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
            <Button startIcon={<AddIcon />} size="small" onClick={addOpcao} sx={{ alignSelf: "flex-start" }}>
              Adicionar opção
            </Button>
          </Stack>
        </Box>
      )}

      {ehGrupo && (
        <Box>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            Configuração do grupo repetível
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              select
              label="Quantidade controlada por"
              value={pergunta.quantidadeOrigemCodigo ?? ""}
              onChange={(e) =>
                set({ quantidadeOrigemCodigo: e.target.value || undefined })
              }
              size="small"
              helperText="Pergunta numérica que define quantos registros abrir"
              sx={{ flex: 1, minWidth: { sm: 220 } }}
            >
              <MenuItem value="">Repetição manual (Adicionar/Remover)</MenuItem>
              {perguntasNumero.map((p) => (
                <MenuItem key={p.codigo} value={p.codigo}>
                  {p.rotulo}
                </MenuItem>
              ))}
            </TextField>
            {!pergunta.quantidadeOrigemCodigo && (
              <>
                <TextField
                  label="Mín. registros"
                  type="number"
                  value={pergunta.minInstancias ?? ""}
                  onChange={(e) =>
                    set({ minInstancias: e.target.value ? Number(e.target.value) : undefined })
                  }
                  size="small"
                  sx={{ width: { xs: "100%", sm: 140 } }}
                />
                <TextField
                  label="Máx. registros"
                  type="number"
                  value={pergunta.maxInstancias ?? ""}
                  onChange={(e) =>
                    set({ maxInstancias: e.target.value ? Number(e.target.value) : undefined })
                  }
                  size="small"
                  sx={{ width: { xs: "100%", sm: 140 } }}
                />
              </>
            )}
          </Stack>

          <Typography variant="subtitle2" sx={{ mt: 2 }} gutterBottom>
            Subperguntas do registro
          </Typography>
          <Stack spacing={1.5}>
            {(pergunta.perguntas ?? []).map((sub, i) => (
              <Paper key={sub.codigo} variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    Subpergunta {i + 1}
                  </Typography>
                  <IconButton size="small" color="error" onClick={() => removerSubpergunta(i)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
                {/* Recursão restrita: outras = demais subperguntas + perguntas
                    top-level (regras podem referenciar ambos). */}
                <PerguntaEditor
                  pergunta={sub}
                  outras={[...(pergunta.perguntas ?? []).filter((_, idx) => idx !== i), ...outras]}
                  onChange={(np) => setSubpergunta(i, np)}
                  emGrupo
                />
              </Paper>
            ))}
            <Button startIcon={<AddIcon />} size="small" onClick={addSubpergunta} sx={{ alignSelf: "flex-start" }}>
              Adicionar subpergunta
            </Button>
          </Stack>
        </Box>
      )}

      {/* Lógica condicional não se aplica ao próprio GRUPO (só a campos comuns). */}
      {!ehGrupo && (
        <>
          <Divider />
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2">Lógica condicional</Typography>
              <Button
                startIcon={<AddIcon />}
                size="small"
                onClick={addRegra}
                disabled={outras.length === 0}
              >
                Adicionar regra
              </Button>
            </Stack>
            {(pergunta.regras ?? []).length === 0 && (
              <Typography variant="caption" color="text.secondary">
                Sempre visível. Adicione uma regra para mostrar/ocultar conforme outra resposta.
              </Typography>
            )}
            <Stack spacing={1} sx={{ mt: 1 }}>
              {(pergunta.regras ?? []).map((r, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <TextField
                    select
                    label="Ação"
                    value={r.acao}
                    onChange={(e) => setRegra(i, { acao: e.target.value as AcaoCondicional })}
                    size="small"
                    sx={{ flex: "1 1 110px", minWidth: { xs: "100%", sm: 110 } }}
                  >
                    <MenuItem value={AcaoCondicional.MOSTRAR}>Mostrar</MenuItem>
                    <MenuItem value={AcaoCondicional.OCULTAR}>Ocultar</MenuItem>
                  </TextField>
                  <Typography variant="body2">se</Typography>
                  <TextField
                    select
                    label="Pergunta"
                    value={r.origemCodigo}
                    onChange={(e) => setRegra(i, { origemCodigo: e.target.value })}
                    size="small"
                    sx={{ flex: "1 1 160px", minWidth: { xs: "100%", sm: 160 } }}
                  >
                    {outras.map((p) => (
                      <MenuItem key={p.codigo} value={p.codigo}>
                        {p.rotulo}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    label="Operador"
                    value={r.operador}
                    onChange={(e) => setRegra(i, { operador: e.target.value as OperadorCondicional })}
                    size="small"
                    sx={{ flex: "1 1 120px", minWidth: { xs: "100%", sm: 120 } }}
                  >
                    <MenuItem value={OperadorCondicional.IGUAL}>igual a</MenuItem>
                    <MenuItem value={OperadorCondicional.DIFERENTE}>diferente de</MenuItem>
                  </TextField>
                  <TextField
                    label="Valor"
                    value={r.valor}
                    onChange={(e) => setRegra(i, { valor: e.target.value })}
                    size="small"
                    helperText="Sim/Não use true/false"
                    sx={{ flex: "1 1 120px", minWidth: { xs: "100%", sm: 120 } }}
                  />
                  <IconButton size="small" color="error" onClick={() => removerRegra(i)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          </Box>
        </>
      )}
    </Stack>
  );
}
