// Gerador de schema Zod a partir de um SchemaFormulario (run-time).
// Usado pelo DynamicForm para validação automática com React Hook Form.

import { z } from "zod";
import {
  AcaoCondicional,
  OperadorCondicional,
  TipoPergunta,
  type Pergunta,
  type SchemaFormulario,
} from "@dcmg/contracts";
import type { SecaoFormulario } from "@dcmg/contracts";
import { cpfValido } from "./masks";

function soDigitos(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

/** Retorna todas as seções do schema, suportando páginas e entrada legada (secoes). */
export function todasSecoes(schema: SchemaFormulario): SecaoFormulario[] {
  if (schema.paginas?.length) return schema.paginas.flatMap((p) => p.secoes ?? []);
  return schema.secoes ?? [];
}

/** Retorna todas as perguntas do schema (achatadas). */
export function todasPerguntas(schema: SchemaFormulario): Pergunta[] {
  return todasSecoes(schema).flatMap((s) => s.perguntas ?? []);
}

function validadorCampo(campo: Pergunta): z.ZodTypeAny {
  const { tipo, obrigatorio, validacoes } = campo;
  let base: z.ZodTypeAny;

  switch (tipo) {
    case TipoPergunta.TEXTO_CURTO:
    case TipoPergunta.TEXTO_LONGO: {
      let s = z.string();
      if (validacoes?.min) s = s.min(validacoes.min, validacoes.mensagem ?? undefined);
      if (validacoes?.max) s = s.max(validacoes.max, validacoes.mensagem ?? undefined);
      if (validacoes?.padrao) s = s.regex(new RegExp(validacoes.padrao), validacoes.mensagem ?? undefined);
      base = obrigatorio ? s.min(1, "Campo obrigatório.") : s.optional().or(z.literal(""));
      break;
    }

    case TipoPergunta.EMAIL:
      base = obrigatorio
        ? z.string().min(1, "Campo obrigatório.").email("E-mail inválido.")
        : z.string().email("E-mail inválido.").optional().or(z.literal(""));
      break;

    case TipoPergunta.URL:
      base = obrigatorio
        ? z.string().min(1, "Campo obrigatório.").url("URL inválida.")
        : z.string().url("URL inválida.").optional().or(z.literal(""));
      break;

    case TipoPergunta.CPF:
      base = z
        .string()
        .optional()
        .superRefine((v, ctx) => {
          if (!v) {
            if (obrigatorio) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Campo obrigatório." });
            return;
          }
          if (!cpfValido(v)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "CPF inválido." });
        });
      break;

    case TipoPergunta.CNPJ:
      base = z
        .string()
        .optional()
        .superRefine((v, ctx) => {
          if (!v) {
            if (obrigatorio) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Campo obrigatório." });
            return;
          }
          if (soDigitos(v).length !== 14) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "CNPJ deve ter 14 dígitos." });
        });
      break;

    case TipoPergunta.CEP:
      base = z
        .string()
        .optional()
        .superRefine((v, ctx) => {
          if (!v) {
            if (obrigatorio) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Campo obrigatório." });
            return;
          }
          if (soDigitos(v).length !== 8) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "CEP deve ter 8 dígitos." });
        });
      break;

    case TipoPergunta.TELEFONE:
      base = z
        .string()
        .optional()
        .superRefine((v, ctx) => {
          if (!v) {
            if (obrigatorio) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Campo obrigatório." });
            return;
          }
          const n = soDigitos(v).length;
          if (n < 10 || n > 11) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Telefone inválido." });
        });
      break;

    case TipoPergunta.NUMERO:
    case TipoPergunta.MOEDA:
    case TipoPergunta.PORCENTAGEM: {
      let n = z.coerce.number({ invalid_type_error: "Informe um número válido." });
      const minPad = tipo === TipoPergunta.PORCENTAGEM ? 0 : undefined;
      const maxPad = tipo === TipoPergunta.PORCENTAGEM ? 100 : undefined;
      const min = validacoes?.min ?? minPad;
      const max = validacoes?.max ?? maxPad;
      if (min !== undefined) n = n.min(min);
      if (max !== undefined) n = n.max(max);
      base = obrigatorio ? n : n.optional();
      break;
    }

    case TipoPergunta.DATA:
      base = obrigatorio
        ? z.string().min(1, "Campo obrigatório.")
        : z.string().optional().or(z.literal(""));
      break;

    case TipoPergunta.LISTA_SUSPENSA:
    case TipoPergunta.RADIO:
      base = obrigatorio
        ? z.string().min(1, "Selecione uma opção.")
        : z.string().optional();
      break;

    case TipoPergunta.CHECKBOX:
      base = obrigatorio
        ? z.array(z.string()).min(1, "Selecione ao menos uma opção.")
        : z.array(z.string()).default([]);
      break;

    case TipoPergunta.SIM_NAO:
      base = obrigatorio
        ? z.boolean({ invalid_type_error: "Selecione Sim ou Não." })
        : z.boolean().optional();
      break;

    case TipoPergunta.UPLOAD:
      base = obrigatorio
        ? z.string().min(1, "Arquivo obrigatório.")
        : z.string().optional().or(z.literal(""));
      break;

    case TipoPergunta.AUTOMATICO:
      base = z.any().optional();
      break;

    default:
      base = z.unknown();
  }

  return base;
}

/** Retorna um z.object com um validador por pergunta do schema. */
export function gerarSchemaZod(schema: SchemaFormulario): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {};
  for (const campo of todasPerguntas(schema)) {
    // Campos AUTOMATICO são preenchidos pelo servidor; não validar no cliente.
    if (campo.tipo === TipoPergunta.AUTOMATICO) {
      shape[campo.codigo] = z.any().optional();
      continue;
    }
    shape[campo.codigo] = validadorCampo(campo);
  }
  return z.object(shape);
}

/** Valores iniciais em branco para todas as perguntas do schema. */
export function construirDefaultValues(schema: SchemaFormulario): Record<string, unknown> {
  const valores: Record<string, unknown> = {};
  for (const campo of todasPerguntas(schema)) {
    switch (campo.tipo) {
      case TipoPergunta.CHECKBOX:
        valores[campo.codigo] = [];
        break;
      case TipoPergunta.SIM_NAO:
        valores[campo.codigo] = undefined;
        break;
      default:
        valores[campo.codigo] = "";
    }
  }
  return valores;
}

/** Avalia se uma pergunta deve ser exibida (lógica condicional). */
export function campoVisivel(
  campo: Pergunta,
  valores: Record<string, unknown>,
): boolean {
  if (!campo.regras || campo.regras.length === 0) return true;

  // Todas as regras precisam ser satisfeitas para a ação resultante.
  for (const regra of campo.regras) {
    const valorOrigem = valores[regra.origemCodigo];
    const igual = comparar(valorOrigem, regra.valor);
    const satisfaz = regra.operador === OperadorCondicional.IGUAL ? igual : !igual;
    if (satisfaz) {
      return regra.acao === AcaoCondicional.MOSTRAR;
    }
  }
  // Nenhuma regra satisfeita: comportamento inverso da primeira ação.
  return campo.regras[0]!.acao !== AcaoCondicional.MOSTRAR;
}

function comparar(valor: unknown, alvo: string): boolean {
  if (typeof valor === "boolean") return String(valor) === alvo;
  if (Array.isArray(valor)) return valor.map(String).includes(alvo);
  return String(valor ?? "") === alvo;
}
