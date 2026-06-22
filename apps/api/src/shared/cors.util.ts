/**
 * Resolução de origens de CORS compartilhada entre o HTTP (main.ts) e o
 * WebSocket gateway. Lê `CORS_ORIGINS` (lista CSV) direto de `process.env`
 * para que possa ser usada também em tempo de decoração (`@WebSocketGateway`),
 * quando o ConfigService ainda não está disponível.
 */

/** Indica se a aplicação está rodando em produção (NODE_ENV ou APP_ENV). */
export function ehProducao(): boolean {
  return (
    process.env['NODE_ENV'] === 'production' ||
    process.env['APP_ENV'] === 'production'
  );
}

/**
 * Retorna a lista de origens permitidas. Quando `CORS_ORIGINS` está vazia:
 * - fora de produção → `true` (libera todas, conveniência de dev);
 * - em produção → `false` (bloqueia tudo). Em produção a `validate()` do Zod
 *   já falha o boot se a lista estiver vazia; o `false` é defesa em profundidade.
 */
export function resolverOrigensCors(): string[] | boolean {
  const bruto = process.env['CORS_ORIGINS'] ?? '';
  const origens = bruto
    .split(',')
    .map((origem) => origem.trim())
    .filter((origem) => origem.length > 0);

  if (origens.length > 0) return origens;
  return ehProducao() ? false : true;
}
