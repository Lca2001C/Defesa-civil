import { z } from 'zod';

/**
 * Validacao das variaveis de ambiente do backend via Zod.
 *
 * Os nomes das variaveis sao canonicos e devem bater EXATAMENTE com
 * o .env.example e o docker-compose.yml. A funcao `validate` e usada
 * pelo ConfigModule.forRoot({ validate }) e lanca em caso de erro,
 * impedindo o boot da aplicacao com configuracao invalida.
 */

/** Numero inteiro positivo a partir de string. */
const intFromString = (padrao: number) =>
  z.coerce.number().int().positive().default(padrao);

export const envSchema = z
  .object({
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

  // --- JWT ---
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_TTL: z.string().min(1).default('900s'),
  JWT_REFRESH_TTL: z.string().min(1).default('7d'),

  // --- Armazenamento de arquivos ---
  STORAGE_DRIVER: z.enum(['local', 'azure']).default('local'),
  STORAGE_LOCAL_PATH: z.string().min(1).default('/data/uploads'),
  // Azure Blob Storage (usado quando STORAGE_DRIVER=azure).
  AZURE_STORAGE_CONNECTION_STRING: z.string().default(''),
  AZURE_STORAGE_CONTAINER: z.string().default('anexos'),

  // --- Limites e infraestrutura ---
  // Limite de upload de anexos em MB.
  MAX_UPLOAD_MB: intFromString(50),
  RATE_LIMIT_TTL: intFromString(60),
  RATE_LIMIT_LIMIT: intFromString(120),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  NGINX_HTTP_PORT: intFromString(8080),

  // --- SMTP (opcional — notificações e recuperação de senha por e-mail) ---
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: intFromString(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('"Defesa Civil MG" <noreply@defesacivil.mg.gov.br>'),
  })
  // Endurecimento adicional exigido SOMENTE em produção.
  .superRefine((cfg, ctx) => {
    if (cfg.NODE_ENV !== 'production') return;

    // CORS não pode ser aberto (liberar todas as origens) em produção.
    if (cfg.CORS_ORIGINS.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message:
          'Em produção é obrigatório definir uma lista branca de origens (CSV). Não é permitido liberar todas.',
      });
    }

    // Segredos JWT precisam ser fortes e distintos em produção.
    for (const chave of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      if (cfg[chave].length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [chave],
          message: 'Em produção deve ter no mínimo 32 caracteres.',
        });
      }
    }
    if (cfg.JWT_ACCESS_SECRET === cfg.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET deve ser diferente de JWT_ACCESS_SECRET.',
      });
    }
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
