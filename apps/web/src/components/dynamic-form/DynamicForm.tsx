// Renderizador dinamico de formularios (paginado).
// Recebe um SchemaFormulario (vindo do backend) e monta os campos com
// React Hook Form + Zod, respeitando paginas, logica condicional e obrigatoriedade.

import { useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { PaginaFormulario, SchemaFormulario } from "@dcmg/contracts";
import { campoVisivel, construirDefaultValues, gerarSchemaZod } from "./schema";
import { REGISTRY } from "./registry";

interface Props {
  schema: SchemaFormulario;
  onSubmit: (dados: Record<string, unknown>) => void | Promise<void>;
  carregando?: boolean;
  defaultValues?: Record<string, unknown>;
  /** Modo preview: nao envia dados de verdade. */
  preview?: boolean;
}

export function DynamicForm({ schema, onSubmit, carregando = false, defaultValues, preview = false }: Props) {
  const zodSchema = useMemo(() => gerarSchemaZod(schema), [schema]);
  const form = useForm<Record<string, unknown>>({
    resolver: zodResolver(zodSchema),
    defaultValues: { ...construirDefaultValues(schema), ...defaultValues },
  });
  const valores = form.watch();

  // Normaliza para páginas (suporta entrada legada apenas com secoes).
  const paginas: PaginaFormulario[] = useMemo(() => {
    if (schema.paginas?.length) return schema.paginas;
    return [{ titulo: schema.titulo ?? "Formulário", secoes: schema.secoes ?? [] }];
  }, [schema]);

  const [paginaAtual, setPaginaAtual] = useState(0);
  const total = paginas.length;
  const ehUltima = paginaAtual >= total - 1;
  const pagina = paginas[Math.min(paginaAtual, total - 1)];

  async function handleSubmit(dados: Record<string, unknown>) {
    if (preview) {
      alert("Preview: o formulário é válido e estaria pronto para envio.");
      return;
    }
    await onSubmit(dados);
  }

  // Valida apenas os campos visíveis da página atual antes de avançar.
  async function avancar() {
    const codigos = (pagina?.secoes ?? [])
      .flatMap((s) => s.perguntas)
      .filter((c) => campoVisivel(c, valores))
      .map((c) => c.codigo);
    const ok = await form.trigger(codigos);
    if (ok) setPaginaAtual((p) => Math.min(p + 1, total - 1));
  }

  return (
    <Box component="form" onSubmit={form.handleSubmit(handleSubmit)} noValidate>
      {total > 1 && (
        <Typography variant="overline" color="text.secondary">
          Página {paginaAtual + 1} de {total}
          {pagina?.titulo ? ` · ${pagina.titulo}` : ""}
        </Typography>
      )}

      {(pagina?.secoes ?? []).map((secao, si) => {
        const camposVisiveis = secao.perguntas.filter((c) => campoVisivel(c, valores));
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
                        <Componente campo={campo} field={field} error={fieldState.error} />
                      )}
                    />
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        );
      })}

      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        {paginaAtual > 0 && (
          <Button variant="outlined" onClick={() => setPaginaAtual((p) => Math.max(p - 1, 0))}>
            Voltar
          </Button>
        )}
        {!ehUltima && (
          <Button variant="contained" onClick={avancar}>
            Avançar
          </Button>
        )}
        {ehUltima && (
          <Button type="submit" variant="contained" disabled={carregando} size="large">
            {carregando ? (
              <CircularProgress size={22} color="inherit" />
            ) : preview ? (
              "Testar preenchimento"
            ) : (
              "Enviar resposta"
            )}
          </Button>
        )}
      </Stack>
    </Box>
  );
}
