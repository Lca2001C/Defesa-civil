import { redigir, ehCampoSensivel, PLACEHOLDER_REDIGIDO } from './redact.util';

describe('redact.util', () => {
  it('reconhece campos sensíveis (case-insensitive e sufixo _secret)', () => {
    expect(ehCampoSensivel('senha')).toBe(true);
    expect(ehCampoSensivel('Authorization')).toBe(true);
    expect(ehCampoSensivel('refreshToken')).toBe(true);
    expect(ehCampoSensivel('JWT_ACCESS_SECRET')).toBe(true);
    expect(ehCampoSensivel('nome')).toBe(false);
  });

  it('redige campos sensíveis aninhados preservando os demais', () => {
    const entrada = {
      nome: 'Lucas',
      senha: '123',
      tokens: { accessToken: 'abc', refreshToken: 'def' },
      authorization: 'Bearer xyz',
    };
    const saida = redigir(entrada) as Record<string, unknown>;
    expect(saida.nome).toBe('Lucas');
    expect(saida.senha).toBe(PLACEHOLDER_REDIGIDO);
    expect((saida.tokens as Record<string, unknown>).accessToken).toBe(PLACEHOLDER_REDIGIDO);
    expect(saida.authorization).toBe(PLACEHOLDER_REDIGIDO);
  });
});
