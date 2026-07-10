// Renderizador dinamico de formularios (paginado).
// Recebe um SchemaFormulario (vindo do backend) e monta os campos com
// React Hook Form + Zod, respeitando paginas, logica condicional e
// obrigatoriedade. A validacao delega a logica ISOMORFICA de @dcmg/contracts
// (a mesma aplicada pela API no envio).

import { useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  Step,
  StepButton,
  StepLabel,
  Stepper,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { TipoPergunta, type PaginaFormulario, type Respostas, type SchemaFormulario } from "@dcmg/contracts";
import {
  caminhoDoErro,
  campoVisivel,
  construirDefaultValues,
  errosDoSchema,
  gerarSchemaZod,
} from "./schema";
import { REGISTRY } from "./registry";

import type { ArquivoUploadado } from "./types";

interface Props {
  schema: SchemaFormulario;
  onSubmit: (dados: Record<string, unknown>) => void | Promise<void>;
  carregando?: boolean;
  defaultValues?: Record<string, unknown>;
  /** Modo preview: nao envia dados de verdade. */
  preview?: boolean;
  /** Callback de upload — passado para campos do tipo UPLOAD. */
  onUpload?: (file: File, perguntaCodigo: string) => Promise<ArquivoUploadado>;
}

export function DynamicForm({ schema, onSubmit, carregando = false, defaultValues, preview = false, onUpload }: Props) {
  const zodSchema = useMemo(() => gerarSchemaZod(schema), [schema]);
  const form = useForm<Record<string, unknown>>({
    resolver: zodResolver(zodSchema),
    defaultValues: { ...construirDefaultValues(schema), ...defaultValues },
  });
  const valores = form.watch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Normaliza para páginas (suporta entrada legada apenas com secoes).
  const paginas: PaginaFormulario[] = useMemo(() => {
    if (schema.paginas?.length) return schema.paginas;
    return [{ titulo: schema.titulo ?? "Formulário", secoes: schema.secoes ?? [] }];
  }, [schema]);

  const [paginaAtual, setPaginaAtual] = useState(0);
  // Etapas ja validadas com sucesso (marca de concluida no Stepper).
  const [concluidas, setConcluidas] = useState<Set<number>>(new Set());
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

  /**
   * Valida APENAS a página atual (recorte do schema) com a lógica isomórfica
   * e reflete os erros no RHF via trigger dos paths afetados. Assim páginas
   * futuras não bloqueiam o avanço.
   */
  async function avancar() {
    const schemaPagina: SchemaFormulario = { versao: schema.versao, paginas: [pagina!] };
    const erros = errosDoSchema(schemaPagina, valores as Respostas);
    if (erros.length > 0) {
      await form.trigger(erros.map((e) => caminhoDoErro(schemaPagina, e)));
      return;
    }
    setConcluidas((s) => new Set(s).add(paginaAtual));
    setPaginaAtual((p) => Math.min(p + 1, total - 1));
  }

  return (
    <FormProvider {...form}>
      <Box component="form" onSubmit={form.handleSubmit(handleSubmit)} noValidate>
        {total > 1 && (
          <Stepper
            nonLinear
            activeStep={paginaAtual}
            alternativeLabel={!isMobile}
            orientation="horizontal"
            sx={{ mb: 3, overflowX: "auto" }}
          >
            {paginas.map((pg, i) => (
              <Step key={pg.id ?? i} completed={concluidas.has(i)}>
                {/* Navegação livre apenas para trás (páginas já visitadas). */}
                {i < paginaAtual ? (
                  <StepButton onClick={() => setPaginaAtual(i)}>
                    {isMobile ? "" : pg.titulo}
                  </StepButton>
                ) : (
                  <StepLabel>{isMobile ? "" : pg.titulo}</StepLabel>
                )}
              </Step>
            ))}
          </Stepper>
        )}
        {total > 1 && isMobile && (
          <Typography variant="overline" color="text.secondary">
            Etapa {paginaAtual + 1} de {total}
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
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, whiteSpace: "pre-wrap" }}>
                  {secao.descricao}
                </Typography>
              )}
              <Divider sx={{ mb: 2 }} />

              <Grid container spacing={2}>
                {camposVisiveis.map((campo) => {
                  const Componente = REGISTRY[campo.tipo];
                  // Grupos, textos longos e informativos ocupam a largura inteira.
                  const larguraTotal =
                    campo.tipo === TipoPergunta.GRUPO ||
                    campo.tipo === TipoPergunta.TEXTO_LONGO ||
                    campo.tipo === TipoPergunta.INFORMATIVO;

                  // INFORMATIVO não é campo de resposta: renderiza sem Controller.
                  if (campo.tipo === TipoPergunta.INFORMATIVO) {
                    return (
                      <Grid key={campo.codigo} item xs={12}>
                        <Componente
                          campo={campo}
                          field={{ name: campo.codigo, value: undefined, onChange: () => {}, onBlur: () => {}, ref: () => {} } as never}
                        />
                      </Grid>
                    );
                  }

                  return (
                    <Grid key={campo.codigo} item xs={12} sm={larguraTotal ? 12 : 6}>
                      <Controller
                        name={campo.codigo}
                        control={form.control}
                        render={({ field, fieldState }) => (
                          <Componente campo={campo} field={field} error={fieldState.error} onUpload={onUpload} />
                        )}
                      />
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          );
        })}

        <Stack
          direction={{ xs: "column-reverse", sm: "row" }}
          spacing={1}
          sx={{ mt: 2 }}
        >
          {paginaAtual > 0 && (
            <Button
              variant="outlined"
              onClick={() => setPaginaAtual((p) => Math.max(p - 1, 0))}
              sx={{ width: { xs: "100%", sm: "auto" } }}
            >
              Voltar
            </Button>
          )}
          {!ehUltima && (
            <Button
              variant="contained"
              onClick={avancar}
              sx={{ width: { xs: "100%", sm: "auto" } }}
            >
              Avançar
            </Button>
          )}
          {ehUltima && (
            <Button
              type="submit"
              variant="contained"
              disabled={carregando}
              size="large"
              sx={{ width: { xs: "100%", sm: "auto" } }}
            >
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
    </FormProvider>
  );
}
