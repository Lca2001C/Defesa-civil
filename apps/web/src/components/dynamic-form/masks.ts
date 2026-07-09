// Máscaras de formatação para campos com formato fixo (CPF, CNPJ, CEP, telefone).
import { TipoPergunta } from "@dcmg/contracts";

function soDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

export function mascaraCpf(v: string): string {
  return soDigitos(v)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function mascaraCnpj(v: string): string {
  return soDigitos(v)
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function mascaraCep(v: string): string {
  return soDigitos(v).slice(0, 8).replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}

export function mascaraTelefone(v: string): string {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

/** MM/AAAA (competência mensal). */
export function mascaraMesAno(v: string): string {
  return soDigitos(v).slice(0, 6).replace(/(\d{2})(\d{1,4})$/, "$1/$2");
}

/** Ano com 4 dígitos. */
export function mascaraAno(v: string): string {
  return soDigitos(v).slice(0, 4);
}

/** Aplica a máscara conforme o tipo da pergunta; retorna o valor formatado. */
export function aplicarMascara(tipo: TipoPergunta, valor: string): string {
  switch (tipo) {
    case TipoPergunta.CPF:
      return mascaraCpf(valor);
    case TipoPergunta.CNPJ:
      return mascaraCnpj(valor);
    case TipoPergunta.CEP:
      return mascaraCep(valor);
    case TipoPergunta.TELEFONE:
      return mascaraTelefone(valor);
    case TipoPergunta.MES_ANO:
      return mascaraMesAno(valor);
    case TipoPergunta.ANO:
      return mascaraAno(valor);
    default:
      return valor;
  }
}

// Validação de CPF: a implementação canônica vive na validação isomórfica.
export { cpfValido } from "@dcmg/contracts";
