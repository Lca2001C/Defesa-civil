// Gerador de schema Zod a partir de um SchemaFormulario (run-time).
// Usado pelo DynamicForm para validacao automatica com React Hook Form.

import { z } from "zod";
import { TipoCampo, type CampoFormulario, type SchemaFormulario } from "@dcmg/contracts";

function validadorCampo(campo: CampoFormulario): z.ZodTypeAny {
  const { tipo, obrigatorio, validacoes } = campo;

  let base: z.ZodTypeAny;

  switch (tipo) {
    case TipoCampo.TEXTO:
    case TipoCampo.CPF:
    case TipoCampo.CNPJ:
    case TipoCampo.CEP: {
      let s = z.string();
      if (validacoes?.min) s = s.min(validacoes.min, validacoes.mensagem ?? undefined);
      if (validacoes?.max) s = s.max(validacoes.max, validacoes.mensagem ?? undefined);
      if (validacoes?.padrao) {
        s = s.regex(new RegExp(validacoes.padrao), validacoes.mensagem ?? undefined);
      }
      base = obrigatorio ? s.min(1, "Campo obrigatório.") : s.optional().or(z.literal(""));
      break;
    }

    case TipoCampo.NUMERO:
    case TipoCampo.MOEDA: {
      let n = z.coerce.number({ invalid_type_error: "Informe um número válido." });
      if (validacoes?.min !== undefined) n = n.min(validacoes.min);
      if (validacoes?.max !== undefined) n = n.max(validacoes.max);
      base = obrigatorio ? n : n.optional();
      break;
    }

    case TipoCampo.DATA:
      base = obrigatorio
        ? z.string().min(1, "Campo obrigatório.")
        : z.string().optional().or(z.literal(""));
      break;

    case TipoCampo.SELECT:
      base = obrigatorio
        ? z.string().min(1, "Selecione uma opção.")
        : z.string().optional();
      break;

    case TipoCampo.MULTISELECT:
      base = z.array(z.string()).default([]);
      break;

    case TipoCampo.BOOLEANO:
      base = z.boolean().default(false);
      break;

    case TipoCampo.ARQUIVO:
      base = z.any().optional();
      break;

    default:
      base = z.unknown();
  }

  return base;
}

/** Retorna um z.object com um validador por campo do schema. */
export function gerarSchemaZod(schema: SchemaFormulario): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {};
  for (const secao of schema.secoes) {
    for (const campo of secao.campos) {
      shape[campo.chave] = validadorCampo(campo);
    }
  }
  return z.object(shape);
}

/** Valores iniciais em branco para todos os campos do schema. */
export function construirDefaultValues(schema: SchemaFormulario): Record<string, unknown> {
  const valores: Record<string, unknown> = {};
  for (const secao of schema.secoes) {
    for (const campo of secao.campos) {
      switch (campo.tipo) {
        case TipoCampo.MULTISELECT:
          valores[campo.chave] = [];
          break;
        case TipoCampo.BOOLEANO:
          valores[campo.chave] = false;
          break;
        default:
          valores[campo.chave] = "";
      }
    }
  }
  return valores;
}

/** Avalia se um campo deve ser exibido (logica condicional simples). */
export function campoVisivel(
  campo: CampoFormulario,
  valores: Record<string, unknown>,
): boolean {
  if (!campo.condicional) return true;
  const { campo: chave, igualA } = campo.condicional;
  const valor = valores[chave];
  return Array.isArray(igualA) ? igualA.includes(valor as never) : valor === igualA;
}
