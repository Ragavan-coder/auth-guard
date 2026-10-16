import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file if present
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_PATH: z.string().min(1).default('./data/authz.db'),
  OIDC_ISSUER_URL: z.string().url(),
  OIDC_AUDIENCE: z.string().min(1),
  OIDC_JWKS_URL: z.string().url().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  TRUST_PROXY: z
    .string()
    .transform((val) => val === 'true' || val === '1')
    .default('false'),
  MAX_REQUEST_BODY_BYTES: z.coerce.number().int().positive().default(16384)
});

export type EnvConfig = z.infer<typeof envSchema>;

export function loadEnv(customEnv?: Record<string, string | undefined>): Readonly<EnvConfig> {
  const source = customEnv || process.env;
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const formattedErrors = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(
      `[AuthZ Guard] FATAL: Invalid application environment configuration:\n${formattedErrors}`
    );
  }

  // Resolve database path relative to process.cwd() if relative
  const config = { ...result.data };
  if (!path.isAbsolute(config.DATABASE_PATH) && config.DATABASE_PATH !== ':memory:') {
    config.DATABASE_PATH = path.resolve(process.cwd(), config.DATABASE_PATH);
  }

  return Object.freeze(config);
}

// Global cached config initialized safely
let cachedConfig: Readonly<EnvConfig> | null = null;

export function getEnv(): Readonly<EnvConfig> {
  if (!cachedConfig) {
    cachedConfig = loadEnv();
  }
  return cachedConfig;
}

export function resetEnvForTesting(
  overrides?: Record<string, string | undefined>
): Readonly<EnvConfig> {
  cachedConfig = loadEnv(overrides);
  return cachedConfig;
}
