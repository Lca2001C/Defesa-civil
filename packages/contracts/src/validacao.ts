/**
 * Validacao ISOMORFICA de respostas contra um SchemaFormulario.
 *
 * Este modulo e TypeScript puro (sem zod ou outras dependencias) de proposito:
 * ele roda tanto no navegador (feedback de preenchimento) quanto na API
 * (barreira de seguranca no envio da submissao — o backend NUNCA deve confiar
 * apenas na validacao do cliente). Toda regra nova de preenchimento deve viver
 * aqui, para as duas pontas enxergarem exatamente o mesmo comportamento.
 */

import {
  AcaoCondicional,
  OperadorCondicional,
  TipoPergunta,
  type Pergunta,
  type SchemaFormulario,
  type SecaoFormulario,
} from './formulario';

/** Erro de validacao de uma resposta. `instancia` aponta o indice no GRUPO. */
export interface ErroValidacao {
  codigo: string;
  mensagem: string;
  /** Indice (0-based) da instancia do grupo em que o erro ocorreu. */
  instancia?: number;
}

/** Mapa de respostas: codigo da pergunta -> valor preenchido. */
export type Respostas = Record<string, unknown>;

// ─── Navegacao no schema ─────────────────────────────────────────────────────

/** Todas as secoes do schema, suportando paginas e a entrada legada (secoes). */
export function todasSecoes(schema: SchemaFormulario): SecaoFormulario[] {
  if (schema.paginas?.length) return schema.paginas.flatMap((p) => p.secoes ?? []);
  return schema.secoes ?? [];
}

/**
 * Todas as perguntas de nivel superior do schema (achatadas por secao).
 * Subperguntas de GRUPO NAO sao achatadas: pertencem ao valor do grupo.
 */
export function todasPerguntas(schema: SchemaFormulario): Pergunta[] {
  return todasSecoes(schema).flatMap((s) => s.perguntas ?? []);
}

// ─── Visibilidade condicional ────────────────────────────────────────────────

function comparar(valor: unknown, alvo: string): boolean {
  if (typeof valor === 'boolean') return String(valor) === alvo;
  if (Array.isArray(valor)) return valor.map(String).includes(alvo);
  return String(valor ?? '') === alvo;
}

/**
 * Avalia se uma pergunta deve ser exibida segundo suas regras condicionais.
 * A primeira regra satisfeita decide a acao; sem nenhuma satisfeita, aplica o
 * inverso da primeira acao (comportamento historico do renderizador).
 */
export function campoVisivel(campo: Pergunta, valores: Respostas): boolean {
  if (!campo.regras || campo.regras.length === 0) return true;

  for (const regra of campo.regras) {
    const valorOrigem = valores[regra.origemCodigo];
    const igual = comparar(valorOrigem, regra.valor);
    const satisfaz = regra.operador === OperadorCondicional.IGUAL ? igual : !igual;
    if (satisfaz) {
      return regra.acao === AcaoCondicional.MOSTRAR;
    }
  }
  return campo.regras[0]!.acao !== AcaoCondicional.MOSTRAR;
}

// ─── Validadores utilitarios ─────────────────────────────────────────────────

/** Remove tudo que nao for digito. */
export function soDigitos(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

/** Valida CPF pelos digitos verificadores. */
export function cpfValido(cpf: string): boolean {
  const d = soDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(d[i]!, 10) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(d[9]!, 10)) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(d[i]!, 10) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === parseInt(d[10]!, 10);
}

/** ANO: exatamente 4 digitos, dentro de uma faixa plausivel. */
const REGEX_ANO = /^\d{4}$/;
const ANO_MIN = 1900;
const ANO_MAX = 2100;

/** MES_ANO: MM/AAAA com mes 01-12. */
const REGEX_MES_ANO = /^(0[1-9]|1[0-2])\/\d{4}$/;

/** HORA: HH:MM em 24h (00:00-23:59). */
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function vazio(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

// ─── Validacao de valor por tipo ─────────────────────────────────────────────

/**
 * Valida o VALOR de uma pergunta (nao-vazio) contra o tipo e as validacoes
 * declaradas. Retorna a mensagem de erro ou null quando valido.
 */
function validarValor(campo: Pergunta, valor: unknown): string | null {
  const v = campo.validacoes;
  const msg = (padrao: string) => v?.mensagem ?? padrao;

  switch (campo.tipo) {
    case TipoPergunta.TEXTO_CURTO:
    case TipoPergunta.TEXTO_LONGO: {
      const s = String(valor);
      if (v?.min && s.length < v.min) return msg(`Minimo de ${v.min} caracteres.`);
      if (v?.max && s.length > v.max) return msg(`Maximo de ${v.max} caracteres.`);
      if (v?.padrao && !new RegExp(v.padrao).test(s)) return msg('Formato invalido.');
      return null;
    }

    case TipoPergunta.EMAIL:
      // Verificacao pragmatica (a definitiva e o proprio envio de e-mail).
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor)) ? null : msg('E-mail invalido.');

    case TipoPergunta.URL:
      try {
        new URL(String(valor));
        return null;
      } catch {
        return msg('URL invalida.');
      }

    case TipoPergunta.CPF:
      return cpfValido(String(valor)) ? null : msg('CPF invalido.');

    case TipoPergunta.CNPJ:
      return soDigitos(valor).length === 14 ? null : msg('CNPJ deve ter 14 digitos.');

    case TipoPergunta.CEP:
      return soDigitos(valor).length === 8 ? null : msg('CEP deve ter 8 digitos.');

    case TipoPergunta.TELEFONE: {
      const n = soDigitos(valor).length;
      return n >= 10 && n <= 11 ? null : msg('Telefone invalido.');
    }

    case TipoPergunta.NUMERO:
    case TipoPergunta.MOEDA:
    case TipoPergunta.PORCENTAGEM: {
      const n = Number(valor);
      if (!Number.isFinite(n)) return msg('Informe um numero valido.');
      const min = v?.min ?? (campo.tipo === TipoPergunta.PORCENTAGEM ? 0 : undefined);
      const max = v?.max ?? (campo.tipo === TipoPergunta.PORCENTAGEM ? 100 : undefined);
      if (min !== undefined && n < min) return msg(`Valor minimo: ${min}.`);
      if (max !== undefined && n > max) return msg(`Valor maximo: ${max}.`);
      return null;
    }

    case TipoPergunta.ANO: {
      const s = String(valor);
      if (!REGEX_ANO.test(s)) return msg('Informe um ano com 4 digitos.');
      const ano = parseInt(s, 10);
      const min = v?.min ?? ANO_MIN;
      const max = v?.max ?? ANO_MAX;
      if (ano < min || ano > max) return msg(`Ano deve estar entre ${min} e ${max}.`);
      return null;
    }

    case TipoPergunta.MES_ANO:
      return REGEX_MES_ANO.test(String(valor)) ? null : msg('Use o formato MM/AAAA.');

    case TipoPergunta.HORA:
      return REGEX_HORA.test(String(valor)) ? null : msg('Use o formato HH:MM.');

    case TipoPergunta.DATA:
      // Aceita ISO (AAAA-MM-DD), formato nativo do input date.
      return /^\d{4}-\d{2}-\d{2}$/.test(String(valor)) ? null : msg('Data invalida.');

    case TipoPergunta.SIM_NAO:
      return typeof valor === 'boolean' ? null : msg('Selecione Sim ou Nao.');

    case TipoPergunta.LISTA_SUSPENSA:
    case TipoPergunta.RADIO:
    case TipoPergunta.CHECKBOX: {
      const validos = new Set((campo.opcoes ?? []).map((o) => o.valor));
      // LISTA_SUSPENSA multipla e CHECKBOX recebem array; os demais, string.
      const esperaArray = campo.tipo === TipoPergunta.CHECKBOX || campo.multipla === true;
      if (esperaArray) {
        if (!Array.isArray(valor)) return msg('Valor invalido (esperada lista de opcoes).');
        for (const item of valor) {
          if (!validos.has(String(item))) return msg(`Opcao invalida: "${String(item)}".`);
        }
        return null;
      }
      if (Array.isArray(valor)) return msg('Valor invalido (esperada uma unica opcao).');
      return validos.has(String(valor)) ? null : msg(`Opcao invalida: "${String(valor)}".`);
    }

    case TipoPergunta.MUNICIPIO: {
      // Shape { id, nome }; a EXISTENCIA do id na base oficial e validada
      // no servidor (unico passo nao-isomorfico, feito na API).
      if (typeof valor !== 'object' || valor === null) return msg('Selecione um municipio.');
      const m = valor as { id?: unknown; nome?: unknown };
      if (!Number.isInteger(Number(m.id)) || Number(m.id) <= 0) return msg('Municipio invalido.');
      if (typeof m.nome !== 'string' || m.nome.trim() === '') return msg('Municipio invalido.');
      return null;
    }

    // UPLOAD e validado no fluxo proprio de anexos; AUTOMATICO e resolvido
    // no servidor; GRUPO e tratado em validarGrupo; INFORMATIVO nao e campo.
    case TipoPergunta.UPLOAD:
    case TipoPergunta.AUTOMATICO:
    case TipoPergunta.INFORMATIVO:
    case TipoPergunta.GRUPO:
      return null;

    default:
      return null;
  }
}

// ─── Validacao de GRUPO (repetivel) ──────────────────────────────────────────

function validarGrupo(
  grupo: Pergunta,
  valor: unknown,
  valoresTopo: Respostas,
  erros: ErroValidacao[],
): void {
  const instancias = Array.isArray(valor) ? valor : [];

  if (!Array.isArray(valor) && !vazio(valor)) {
    erros.push({ codigo: grupo.codigo, mensagem: 'Valor invalido (esperada lista de registros).' });
    return;
  }

  // Quantidade exata controlada por outra pergunta NUMERO.
  if (grupo.quantidadeOrigemCodigo) {
    const qtd = Number(valoresTopo[grupo.quantidadeOrigemCodigo]);
    if (Number.isFinite(qtd) && qtd >= 0 && instancias.length !== qtd) {
      erros.push({
        codigo: grupo.codigo,
        mensagem: `Preencha ${qtd} registro(s) — foram informados ${instancias.length}.`,
      });
    }
  } else {
    if (grupo.minInstancias !== undefined && instancias.length < grupo.minInstancias) {
      erros.push({ codigo: grupo.codigo, mensagem: `Informe ao menos ${grupo.minInstancias} registro(s).` });
    }
    if (grupo.maxInstancias !== undefined && instancias.length > grupo.maxInstancias) {
      erros.push({ codigo: grupo.codigo, mensagem: `Maximo de ${grupo.maxInstancias} registro(s).` });
    }
  }

  if (grupo.obrigatorio && instancias.length === 0 && !grupo.quantidadeOrigemCodigo) {
    erros.push({ codigo: grupo.codigo, mensagem: 'Informe ao menos um registro.' });
  }

  // Valida cada subpergunta por instancia. Regras condicionais de subperguntas
  // resolvem a origem primeiro DENTRO da instancia; se ausente, no topo.
  const subperguntas = grupo.perguntas ?? [];
  instancias.forEach((instancia, indice) => {
    const valoresInstancia =
      typeof instancia === 'object' && instancia !== null
        ? (instancia as Respostas)
        : ({} as Respostas);
    const contexto: Respostas = { ...valoresTopo, ...valoresInstancia };

    for (const sub of subperguntas) {
      if (!campoVisivel(sub, contexto)) continue;
      const v = valoresInstancia[sub.codigo];
      if (vazio(v)) {
        if (sub.obrigatorio) {
          erros.push({ codigo: sub.codigo, instancia: indice, mensagem: 'Campo obrigatorio.' });
        }
        continue;
      }
      const erro = validarValor(sub, v);
      if (erro) erros.push({ codigo: sub.codigo, instancia: indice, mensagem: erro });
    }
  });
}

// ─── API principal ───────────────────────────────────────────────────────────

/**
 * Valida as respostas contra o schema completo. Retorna a lista de erros
 * (vazia = valido). Regras aplicadas:
 *  - obrigatoriedade APENAS de perguntas visiveis (regras condicionais);
 *  - tipo/formato do valor por TipoPergunta;
 *  - opcoes validas em listas (incluindo arrays de CHECKBOX/multipla);
 *  - GRUPO: quantidade de instancias + subperguntas por instancia.
 * UPLOAD e AUTOMATICO sao ignorados (validados em fluxos proprios).
 */
export function validarRespostas(schema: SchemaFormulario, dados: Respostas): ErroValidacao[] {
  const erros: ErroValidacao[] = [];

  for (const campo of todasPerguntas(schema)) {
    // AUTOMATICO/UPLOAD tem fluxo proprio; INFORMATIVO nao e campo de resposta.
    if (
      campo.tipo === TipoPergunta.AUTOMATICO ||
      campo.tipo === TipoPergunta.UPLOAD ||
      campo.tipo === TipoPergunta.INFORMATIVO
    ) {
      continue;
    }
    if (!campoVisivel(campo, dados)) continue;

    const valor = dados[campo.codigo];

    if (campo.tipo === TipoPergunta.GRUPO) {
      validarGrupo(campo, valor, dados, erros);
      continue;
    }

    if (vazio(valor)) {
      if (campo.obrigatorio) {
        erros.push({ codigo: campo.codigo, mensagem: 'Campo obrigatorio.' });
      }
      continue;
    }

    const erro = validarValor(campo, valor);
    if (erro) erros.push({ codigo: campo.codigo, mensagem: erro });
  }

  return erros;
}
