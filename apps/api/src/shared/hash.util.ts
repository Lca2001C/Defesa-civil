import * as argon2 from 'argon2';

/**
 * Parâmetros endurecidos do Argon2id, alinhados à recomendação do OWASP
 * Password Storage Cheat Sheet (m=19 MiB, t=2, p=1).
 *
 * `argon2.verify` lê os parâmetros embutidos no próprio hash, então alterar
 * estes valores NÃO invalida hashes já gravados — logins existentes continuam
 * funcionando, e novos hashes passam a usar os parâmetros endurecidos.
 */
const OPCOES_ARGON2 = {
  type: argon2.argon2id,
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} satisfies argon2.Options;

/** Gera o hash Argon2id de uma senha (ou segredo) com parâmetros endurecidos. */
export function hashSenha(senha: string): Promise<string> {
  return argon2.hash(senha, OPCOES_ARGON2);
}

/** Verifica uma senha contra um hash. Retorna `false` em qualquer erro. */
export function verificarSenha(hash: string, senha: string): Promise<boolean> {
  return argon2.verify(hash, senha).catch(() => false);
}
