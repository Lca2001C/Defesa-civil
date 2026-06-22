import { hashSenha, verificarSenha } from './hash.util';

describe('hash.util (Argon2id)', () => {
  it('gera hash argon2id e verifica a senha correta', async () => {
    const hash = await hashSenha('Senha@2026');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verificarSenha(hash, 'Senha@2026')).toBe(true);
  });

  it('rejeita senha incorreta', async () => {
    const hash = await hashSenha('Senha@2026');
    expect(await verificarSenha(hash, 'errada')).toBe(false);
  });

  it('verify continua válido para hash gerado com parâmetros default antigos', async () => {
    // Hash de "Senha@2026" gerado com argon2id usando apenas { type } (defaults).
    const argon2 = await import('argon2');
    const hashAntigo = await argon2.hash('Senha@2026', { type: argon2.argon2id });
    expect(await verificarSenha(hashAntigo, 'Senha@2026')).toBe(true);
  });

  it('verify retorna false (não lança) para hash inválido', async () => {
    expect(await verificarSenha('não-é-hash', 'x')).toBe(false);
  });
});
