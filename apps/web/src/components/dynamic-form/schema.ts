// Adaptador entre o SchemaFormulario e o React Hook Form (zodResolver).
//
// A validacao de VERDADE e a isomorfica de @dcmg/contracts (validarRespostas):
// a MESMA logica roda aqui (feedback de preenchimento) e na API (barreira de
// seguranca no envio). Este arquivo apenas adapta os erros para o formato do
// RHF (paths) e cobre o unico caso exclusivo do cliente (UPLOAD obrigatorio,
// que no servidor e validado pelo fluxo de anexos).

import { z } from "zod";
import {
  TipoPergunta,
  campoVisivel,
  todasPerguntas,
  todasSecoes,
  validarRespostas,
  type ErroValidacao,
  type Pergunta,
  type Respostas,
  type SchemaFormulario,
} from "@dcmg/contracts";

// Reexporta a logica isomorfica para os consumidores existentes do web
// (DynamicForm, SubmissaoNova, etc.) continuarem importando deste modulo.
export { campoVisivel, todasPerguntas, todasSecoes };

/**
 * Converte um ErroValidacao no path do RHF.
 * Erros de subpergunta de GRUPO viram "grupo.indice.subpergunta" (formato do
 * useFieldArray); os demais usam o proprio codigo.
 */
export function caminhoDoErro(schema: SchemaFormulario, erro: ErroValidacao): string {
  if (erro.instancia === undefined) return erro.codigo;
  for (const campo of todasPerguntas(schema)) {
    if (campo.tipo !== TipoPergunta.GRUPO) continue;
    if (campo.perguntas?.some((sub) => sub.codigo === erro.codigo)) {
      return `${campo.codigo}.${erro.instancia}.${erro.codigo}`;
    }
  }
  return erro.codigo;
}

/**
 * Erros de preenchimento do schema (isomorficos + UPLOAD obrigatorio, que so
 * o cliente conhece — no servidor o anexo e validado no fluxo proprio).
 */
export function errosDoSchema(schema: SchemaFormulario, dados: Respostas): ErroValidacao[] {
  const erros = validarRespostas(schema, dados);
  for (const campo of todasPerguntas(schema)) {
    if (campo.tipo !== TipoPergunta.UPLOAD || !campo.obrigatorio) continue;
    if (!campoVisivel(campo, dados)) continue;
    const valor = dados[campo.codigo];
    if (valor === undefined || valor === null || valor === "") {
      erros.push({ codigo: campo.codigo, mensagem: "Arquivo obrigatório." });
    }
  }
  return erros;
}

/** Schema zod que delega toda a validacao a logica isomorfica. */
export function gerarSchemaZod(schema: SchemaFormulario) {
  return z.record(z.string(), z.unknown()).superRefine((dados, ctx) => {
    for (const erro of errosDoSchema(schema, dados as Respostas)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: erro.mensagem,
        path: caminhoDoErro(schema, erro).split("."),
      });
    }
  });
}

/** Valores iniciais em branco para todas as perguntas do schema. */
export function construirDefaultValues(schema: SchemaFormulario): Record<string, unknown> {
  const valores: Record<string, unknown> = {};
  for (const campo of todasPerguntas(schema)) {
    valores[campo.codigo] = valorInicial(campo);
  }
  return valores;
}

/** Valor inicial em branco de UM campo (tambem usado nas instancias de GRUPO). */
export function valorInicial(campo: Pergunta): unknown {
  switch (campo.tipo) {
    case TipoPergunta.CHECKBOX:
    case TipoPergunta.GRUPO:
      return [];
    case TipoPergunta.SIM_NAO:
      return undefined;
    case TipoPergunta.MUNICIPIO:
      return null;
    default:
      // LISTA_SUSPENSA multipla tambem armazena array.
      return campo.multipla ? [] : "";
  }
}

/** Instancia em branco de um GRUPO (uma linha do array de respostas). */
export function instanciaVazia(grupo: Pergunta): Record<string, unknown> {
  const valores: Record<string, unknown> = {};
  for (const sub of grupo.perguntas ?? []) {
    valores[sub.codigo] = valorInicial(sub);
  }
  return valores;
}
