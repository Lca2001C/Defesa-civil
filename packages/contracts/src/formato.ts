/**
 * Formatação ISOMÓRFICA de respostas para exibição (leitura humana).
 *
 * Usada tanto pela API (export PDF/Excel) quanto pelo web (tela de detalhe da
 * submissão), para que o mesmo valor bruto apareça igual nas duas pontas —
 * evitando "[object Object]" em MUNICIPIO/GRUPO e divergências de rótulo.
 */

import { TipoPergunta, type Pergunta } from './formulario';

/** Rótulo de uma opção pelo valor persistido (fallback: o próprio valor). */
function rotuloOpcao(pergunta: Pergunta, valor: unknown): string {
  return pergunta.opcoes?.find((o) => o.valor === String(valor))?.rotulo ?? String(valor);
}

/** Converte o valor bruto de uma resposta em texto legível conforme o tipo. */
export function formatarResposta(pergunta: Pergunta, valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—';

  switch (pergunta.tipo) {
    case TipoPergunta.SIM_NAO:
      return valor === true || valor === 'true' ? 'Sim' : 'Não';

    case TipoPergunta.RADIO:
      return rotuloOpcao(pergunta, valor);

    case TipoPergunta.LISTA_SUSPENSA:
      if (Array.isArray(valor)) {
        return valor.length ? valor.map((v) => rotuloOpcao(pergunta, v)).join(', ') : '—';
      }
      return rotuloOpcao(pergunta, valor);

    case TipoPergunta.CHECKBOX: {
      const lista = Array.isArray(valor) ? valor : [valor];
      const rotulos = lista.map((v) => rotuloOpcao(pergunta, v));
      return rotulos.length ? rotulos.join(', ') : '—';
    }

    case TipoPergunta.MUNICIPIO:
      if (valor && typeof valor === 'object') {
        return String((valor as { nome?: string }).nome ?? '—');
      }
      return String(valor);

    case TipoPergunta.GRUPO: {
      const instancias = Array.isArray(valor) ? (valor as Record<string, unknown>[]) : [];
      if (!instancias.length) return '—';
      const subs = pergunta.perguntas ?? [];
      return instancias
        .map((inst, i) => {
          const partes = subs.map((s) => `${s.rotulo}: ${formatarResposta(s, inst[s.codigo])}`);
          return `Registro ${i + 1} — ${partes.join('; ')}`;
        })
        .join('\n');
    }

    case TipoPergunta.UPLOAD:
      return 'Arquivo anexado';

    // INFORMATIVO nao possui resposta (componente visual).
    case TipoPergunta.INFORMATIVO:
      return '—';

    default:
      return String(valor);
  }
}
