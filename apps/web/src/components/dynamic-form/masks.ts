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
    default:
      return valor;
  }
}

/** Valida CPF (dígitos verificadores). */
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
