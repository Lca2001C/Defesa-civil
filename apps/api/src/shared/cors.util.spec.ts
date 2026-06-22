import { resolverOrigensCors, ehProducao } from './cors.util';

describe('cors.util', () => {
  const envOriginal = { ...process.env };
  afterEach(() => {
    process.env = { ...envOriginal };
  });

  it('retorna a lista de origens quando CORS_ORIGINS está definida', () => {
    process.env['CORS_ORIGINS'] = 'https://a.gov.br, https://b.gov.br';
    expect(resolverOrigensCors()).toEqual(['https://a.gov.br', 'https://b.gov.br']);
  });

  it('libera tudo (true) fora de produção quando vazia', () => {
    process.env['CORS_ORIGINS'] = '';
    process.env['NODE_ENV'] = 'development';
    process.env['APP_ENV'] = 'development';
    expect(resolverOrigensCors()).toBe(true);
  });

  it('bloqueia tudo (false) em produção quando vazia', () => {
    process.env['CORS_ORIGINS'] = '';
    process.env['NODE_ENV'] = 'production';
    expect(ehProducao()).toBe(true);
    expect(resolverOrigensCors()).toBe(false);
  });
});
