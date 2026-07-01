import {
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  TipoPergunta,
  type OpcaoPergunta,
  type Pergunta,
  type RegraCondicional,
  OperadorCondicional,
  AcaoCondicional,
} from "@dcmg/contracts";
import { FONTES_AUTOMATICAS, TIPOS, TIPOS_COM_OPCOES } from "./tipos";

interface Props {
  pergunta: Pergunta;
  /** Outras perguntas do formulário (para configurar regras condicionais). */
  outras: Pergunta[];
  onChange: (p: Pergunta) => void;
}

export function PerguntaEditor({ pergunta, outras, onChange }: Props) {
  const set = (patch: Partial<Pergunta>) => onChange({ ...pergunta, ...patch });
  const temOpcoes = TIPOS_COM_OPCOES.includes(pergunta.tipo);

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
          {TIPOS.map((t) => (
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

      {temOpcoes && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Opções
          </Typography>
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
                />
                <IconButton size="small" color="error" onClick={() => removerOpcao(i)}>
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
    </Stack>
  );
}
