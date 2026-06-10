import { z } from 'zod';

/**
 * Validacao das variaveis de ambiente do backend via Zod.
 *
 * Os nomes das variaveis sao canonicos e devem bater EXATAMENTE com
 * o .env.example e o docker-compose.yml. A funcao `validate` e usada
 * pelo ConfigModule.forRoot({ validate }) e lanca em caso de erro,
 * impedindo o boot da aplicacao com configuracao invalida.
 */

/** Converte uma string "true"/"false" em boolean (com valor padrao). */
const booleanFromString = (padrao: boolean) =>
  z
    .preprocess(
      // String vazia (ex.: S3_FORCE_PATH_STYLE= no .env) ou ausente usa o padrao.
      (valor) => (valor === '' || valor === undefined ? padrao : valor),
      z.union([z.boolean(), z.enum(['true', 'false', '1', '0'])]),
    )
    .transform((valor) => {
      if (typeof valor === 'boolean') return valor;
      return valor === 'true' || valor === '1';
    });

/** Numero inteiro positivo a partir de string. */
const intFromString = (padrao: number) =>
  z.coerce.number().int().positive().default(padrao);

export const envSchema = z.object({
  // --- Aplicacao ---
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  APP_ENV: z.string().min(1).default('development'),
  PORT: intFromString(4000),
  API_PREFIX: z.string().min(1).default('api'),
  // Lista separada por virgula de origens permitidas no CORS.
  CORS_ORIGINS: z.string().default(''),
  PUBLIC_BASE_URL: z.string().url().or(z.literal('')).default(''),

  // --- Banco de dados (PostgreSQL) ---
  DATABASE_URL: z.string().min(1),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  POSTGRES_DB: z.string().min(1),

  // --- Redis ---
  REDIS_URL: z.string().min(1),

  // --- JWT ---
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_TTL: z.string().min(1).default('900s'),
  JWT_REFRESH_TTL: z.string().min(1).default('7d'),

  // --- Armazenamento de arquivos ---
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_PATH: z.string().min(1).default('/data/uploads'),
  // Configuracao S3 fica vazia na Fase 1.
  S3_ENDPOINT: z.string().default(''),
  S3_BUCKET: z.string().default(''),
  S3_REGION: z.string().default(''),
  S3_ACCESS_KEY: z.string().default(''),
  S3_SECRET_KEY: z.string().default(''),
  S3_FORCE_PATH_STYLE: booleanFromString(false),

  // --- Limites e infraestrutura ---
  MAX_UPLOAD_MB: intFromString(25),
  WS_REDIS_ADAPTER: booleanFromString(true),
  RATE_LIMIT_TTL: intFromString(60),
  RATE_LIMIT_LIMIT: intFromString(120),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  NGINX_HTTP_PORT: intFromString(8080),
});

/** Tipo das variaveis de ambiente ja validadas e normalizadas. */
export type Env = z.infer<typeof envSchema>;

/**
 * Funcao de validacao usada pelo ConfigModule.
 * Recebe o objeto bruto (process.env) e retorna a versao tipada.
 * Lanca um erro legivel listando todas as variaveis invalidas.
 */
export function validate(config: Record<string, unknown>): Env {
  const resultado = envSchema.safeParse(config);

  if (!resultado.success) {
    const detalhes = resultado.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Variaveis de ambiente invalidas:\n${detalhes}`,
    );
  }

  return resultado.data;
}
