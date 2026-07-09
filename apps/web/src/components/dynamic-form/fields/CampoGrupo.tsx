// Campo GRUPO: bloco repetivel de subperguntas (ex.: cadastro individual de
// cursos ou do efetivo). O numero de instancias e controlado por uma pergunta
// NUMERO do formulario (quantidadeOrigemCodigo — "informe 3 cursos" abre
// exatamente 3 blocos) ou por botoes Adicionar/Remover com min/max.
//
// O valor no formulario e um array de objetos { [codigoSubpergunta]: valor },
// mesmo shape validado pela logica isomorfica e persistido na Resposta.

import { useEffect } from "react";
import {
  Box,
  Button,
  Grid,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { campoVisivel, type Pergunta, type Respostas } from "@dcmg/contracts";
import { instanciaVazia } from "../schema";
import type { FieldProps } from "../types";
// Import circular INTENCIONAL (registry -> CampoGrupo -> registry): em modulos
// ES o binding e resolvido em tempo de render, quando o REGISTRY ja existe.
// Grupos nao aninham (o backend rejeita GRUPO dentro de GRUPO), entao a
// recursao para no primeiro nivel.
import { REGISTRY } from "../registry";

export function CampoGrupo({ campo, error }: FieldProps) {
  const { control } = useFormContext();
  const { fields, append, remove, replace } = useFieldArray({ control, name: campo.codigo });

  // Valores completos do formulario: contexto das regras condicionais das
  // subperguntas (origem pode ser top-level ou da propria instancia).
  const valores = (useWatch({ control }) ?? {}) as Respostas;

  const controladoPorQuantidade = !!campo.quantidadeOrigemCodigo;
  const quantidadeBruta = controladoPorQuantidade
    ? Number(valores[campo.quantidadeOrigemCodigo!])
    : NaN;
  const quantidadeAlvo =
    Number.isFinite(quantidadeBruta) && quantidadeBruta >= 0
      ? Math.min(Math.floor(quantidadeBruta), 100) // teto defensivo de render
      : null;

  // Sincroniza o numero de instancias com a pergunta controladora: estende com
  // instancias vazias ou TRUNCA o excedente (comportamento documentado).
  useEffect(() => {
    if (!controladoPorQuantidade || quantidadeAlvo === null) return;
    if (fields.length === quantidadeAlvo) return;
    const atuais = (valores[campo.codigo] as Record<string, unknown>[] | undefined) ?? [];
    const novas = Array.from({ length: quantidadeAlvo }, (_, i) => atuais[i] ?? instanciaVazia(campo));
    replace(novas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantidadeAlvo, controladoPorQuantidade, fields.length]);

  const podeAdicionar =
    !controladoPorQuantidade &&
    (campo.maxInstancias === undefined || fields.length < campo.maxInstancias);
  const podeRemover =
    !controladoPorQuantidade &&
    (campo.minInstancias === undefined || fields.length > campo.minInstancias);

  const subperguntas = campo.perguntas ?? [];

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {campo.rotulo}
        {campo.obrigatorio ? " *" : ""}
      </Typography>
      {campo.ajuda && (
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
          {campo.ajuda}
        </Typography>
      )}
      {error?.message && (
        <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>
          {error.message}
        </Typography>
      )}

      {fields.length === 0 && controladoPorQuantidade && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Informe a quantidade acima para abrir os registros.
        </Typography>
      )}

      {fields.map((item, indice) => {
        const valoresInstancia =
          ((valores[campo.codigo] as Record<string, unknown>[] | undefined)?.[indice] ??
            {}) as Respostas;
        // Contexto condicional: valores da instancia tem precedencia sobre o topo.
        const contexto: Respostas = { ...valores, ...valoresInstancia };

        return (
          <Paper key={item.id} variant="outlined" sx={{ p: 2, mt: 1.5 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                {campo.rotulo} — registro {indice + 1}
              </Typography>
              {podeRemover && (
                <Tooltip title="Remover este registro">
                  <IconButton size="small" color="error" onClick={() => remove(indice)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            <Grid container spacing={2}>
              {subperguntas
                .filter((sub) => campoVisivel(sub, contexto))
                .map((sub: Pergunta) => {
                  const Componente = REGISTRY[sub.tipo];
                  return (
                    <Grid key={sub.codigo} item xs={12} sm={6}>
                      <Controller
                        name={`${campo.codigo}.${indice}.${sub.codigo}`}
                        control={control}
                        render={({ field, fieldState }) => (
                          <Componente campo={sub} field={field} error={fieldState.error} />
                        )}
                      />
                    </Grid>
                  );
                })}
            </Grid>
          </Paper>
        );
      })}

      {podeAdicionar && (
        <Button
          startIcon={<AddIcon />}
          size="small"
          sx={{ mt: 1 }}
          onClick={() => append(instanciaVazia(campo))}
        >
          Adicionar registro
        </Button>
      )}
    </Box>
  );
}
