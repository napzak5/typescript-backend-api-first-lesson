import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { type Environment, environmentSchema } from './environment'

/**
 * Configuration of the API server, read from environment variables. Only
 * what the server uses is declared here; every variable is required, so a
 * missing or malformed one stops the start-up instead of surfacing later.
 */

const wholeNumber = (minimum: number, maximum: number) =>
  z
    .string()
    .regex(/^\d+$/, 'Must be a whole number')
    .transform(Number)
    .pipe(z.number().min(minimum).max(maximum))

const flag = z.enum(['true', 'false']).transform((value) => value === 'true')

const isOrigin = (value: string): boolean =>
  URL.canParse(value) && new URL(value).origin === value

const origins = z
  .string()
  .transform((value) => value.split(',').map((origin) => origin.trim()))
  .pipe(
    z
      .array(
        z
          .string()
          .refine(isOrigin, 'Must be origins such as https://example.com'),
      )
      .min(1),
  )

const isPostgresUrl = (value: string): boolean =>
  URL.canParse(value) &&
  ['postgres:', 'postgresql:'].includes(new URL(value).protocol)

const logLevelSchema = z.enum([
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
])

const logFormatSchema = z.enum(['json', 'pretty'])

const variablesSchema = z.object({
  NODE_ENV: environmentSchema,
  HOST: z.string().min(1),
  PORT: wholeNumber(1, 65535),
  TRUST_PROXY_HOPS: wholeNumber(0, 10),
  DATABASE_URL: z.string().refine(isPostgresUrl, 'Must be a postgres:// URL'),
  DATABASE_POOL_MAX: wholeNumber(1, 1000),
  DATABASE_CONNECTION_TIMEOUT: wholeNumber(1000, 600_000),
  CORS_ORIGIN: origins,
  CORS_CREDENTIALS: flag,
  CORS_MAX_AGE: wholeNumber(0, 86_400),
  RATE_LIMIT_WINDOW_MS: wholeNumber(1000, 86_400_000),
  RATE_LIMIT_MAX_REQUESTS: wholeNumber(1, 1_000_000),
  LOG_LEVEL: logLevelSchema,
  LOG_FORMAT: logFormatSchema,
})

export type LogLevel = z.infer<typeof logLevelSchema>
export type LogFormat = z.infer<typeof logFormatSchema>

export type AppConfig = {
  environment: Environment
  server: {
    host: string
    port: number
    /** Reverse proxies in front of the server; 0 when clients connect directly. */
    trustProxyHops: number
  }
  database: {
    url: string
    poolMax: number
    connectTimeoutMs: number
  }
  cors: {
    origins: string[]
    credentials: boolean
    maxAgeSeconds: number
  }
  rateLimit: {
    windowMs: number
    maxRequests: number
  }
  logging: {
    level: LogLevel
    format: LogFormat
  }
}

/** What is wrong with one variable. The value is left out: it may be a secret. */
export type ConfigIssue = {
  variable: string
  message: string
}

const toAppConfig = (
  variables: z.infer<typeof variablesSchema>,
): AppConfig => ({
  environment: variables.NODE_ENV,
  server: {
    host: variables.HOST,
    port: variables.PORT,
    trustProxyHops: variables.TRUST_PROXY_HOPS,
  },
  database: {
    url: variables.DATABASE_URL,
    poolMax: variables.DATABASE_POOL_MAX,
    connectTimeoutMs: variables.DATABASE_CONNECTION_TIMEOUT,
  },
  cors: {
    origins: variables.CORS_ORIGIN,
    credentials: variables.CORS_CREDENTIALS,
    maxAgeSeconds: variables.CORS_MAX_AGE,
  },
  rateLimit: {
    windowMs: variables.RATE_LIMIT_WINDOW_MS,
    maxRequests: variables.RATE_LIMIT_MAX_REQUESTS,
  },
  logging: {
    level: variables.LOG_LEVEL,
    format: variables.LOG_FORMAT,
  },
})

/** Reads the configuration from environment variables such as `process.env`. */
export const parseAppConfig = (
  variables: Record<string, string | undefined>,
): Result<AppConfig, ConfigIssue[]> => {
  const parsed = variablesSchema.safeParse(variables)

  return parsed.success
    ? Result.success(toAppConfig(parsed.data))
    : Result.error(
        // The first path segment is the variable; the rest points inside it.
        parsed.error.issues.map(({ path, message }) => ({
          variable: path.slice(0, 1).map(String).join(),
          message,
        })),
      )
}
