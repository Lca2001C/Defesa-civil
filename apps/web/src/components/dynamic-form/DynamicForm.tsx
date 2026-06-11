// Renderizador dinamico de formularios.
// Recebe um SchemaFormulario (vindo do backend) e monta os campos com
// React Hook Form + Zod, respeitando logica condicional e obrigatoriedade.

import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Grid,
  Typography,
} from "@mui/material";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { SchemaFormulario } from "@dcmg/contracts";
import { campoVisivel, construirDefaultValues, gerarSchemaZod } from "./schema";
import { REGISTRY } from "./registry";

interface Props {
  schema: SchemaFormulario;
  onSubmit: (dados: Record<string, unknown>) => void | Promise<void>;
  carregando?: boolean;
  /** Modo preview: exibe o botao "Preencher" mas nao envia dados de verdade. */
  preview?: boolean;
}

export function DynamicForm({ schema, onSubmit, carregando = false, preview = false }: Props) {
  const zodSchema = gerarSchemaZod(schema);
  const form = useForm<Record<string, unknown>>({
    resolver: zodResolver(zodSchema),
    defaultValues: construirDefaultValues(schema),
  });
  const valores = form.watch();

  async function handleSubmit(dados: Record<string, unknown>) {
    if (preview) {
      alert("Preview: o formulário é válido e estaria pronto para envio.");
      return;
    }
    await onSubmit(dados);
  }

  return (
    <Box
      component="form"
      onSubmit={form.handleSubmit(handleSubmit)}
      noValidate
    >
      {schema.secoes.map((secao, si) => {
        const camposVisiveis = secao.perguntas.filter((c) =>
          campoVisivel(c, valores),
        );
        if (camposVisiveis.length === 0) return null;

        return (
          <Box key={secao.id ?? si} sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              {secao.titulo}
            </Typography>
            {secao.descricao && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {secao.descricao}
              </Typography>
            )}
            <Divider sx={{ mb: 2 }} />

            <Grid container spacing={2}>
              {camposVisiveis.map((campo) => {
                const Componente = REGISTRY[campo.tipo];
                return (
                  <Grid key={campo.codigo} item xs={12} sm={6}>
                    <Controller
                      name={campo.codigo}
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Componente
                          campo={campo}
                          field={field}
                          error={fieldState.error}
                        />
                      )}
                    />
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        );
      })}

      <Box sx={{ mt: 2 }}>
        <Button
          type="submit"
          variant="contained"
          disabled={carregando}
          size="large"
        >
          {carregando ? (
            <CircularProgress size={22} color="inherit" />
          ) : preview ? (
            "Testar preenchimento"
          ) : (
            "Enviar resposta"
          )}
        </Button>
      </Box>
    </Box>
  );
}
