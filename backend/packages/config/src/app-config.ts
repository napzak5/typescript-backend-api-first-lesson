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

const smtpTlsSchema = z.enum(['implicit', 'starttls', 'none'])

/** Where an object storage is reached: `https://storage.example.com`, without a path. */
const storageEndpoint = z
  .string()
  .refine(
    (value) => isOrigin(value) && /^https?:/.test(value),
    'Must be an origin such as https://storage.example.com',
  )

/** A bucket name as S3 allows it: 3 to 63 lower-case letters, digits, dots and hyphens. */
const bucketName = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/,
    'Must be 3 to 63 lower-case letters, digits, dots and hyphens',
  )

/** `no-reply@example.com`, or with a display name: `Beauty Salon <no-reply@example.com>`. */
const isSender = (value: string): boolean => {
  const address = /^[^<>]+<([^<>\s]+)>$/.exec(value)?.[1] ?? value
  return z.email().safeParse(address).success
}

/** Environments that real users reach: nothing may travel unencrypted there. */
const isDeployed = (environment: Environment): boolean =>
  environment === 'production' || environment === 'staging'

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
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: wholeNumber(1, 65535),
  SMTP_TLS: smtpTlsSchema,
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  MAIL_FROM: z
    .string()
    .refine(isSender, 'Must be an address such as Name <user@example.com>'),
  PUBLIC_APP_URL: z
    .string()
    .refine(isOrigin, 'Must be an origin such as https://example.com'),
  TWO_FACTOR_ENCRYPTION_KEY: z.string().min(32),
  STORAGE_ENDPOINT: storageEndpoint,
  STORAGE_PUBLIC_ENDPOINT: storageEndpoint,
  STORAGE_REGION: z.string().min(1),
  STORAGE_BUCKET: bucketName,
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  LOG_LEVEL: logLevelSchema,
  LOG_FORMAT: logFormatSchema,
})

/** What a single variable cannot tell: rules that depend on the environment. */
const deployedVariablesSchema = variablesSchema.check((context) => {
  const {
    NODE_ENV,
    SMTP_TLS,
    PUBLIC_APP_URL,
    STORAGE_ENDPOINT,
    STORAGE_PUBLIC_ENDPOINT,
  } = context.value
  // Only variables that are well-formed on their own are compared.
  if (context.issues.length > 0 || !isDeployed(NODE_ENV)) {
    return
  }

  if (SMTP_TLS === 'none') {
    context.issues.push({
      code: 'custom',
      path: ['SMTP_TLS'],
      message: `Must be implicit or starttls in ${NODE_ENV}`,
      input: SMTP_TLS,
    })
  }
  // The links in mails carry tokens.
  if (!PUBLIC_APP_URL.startsWith('https://')) {
    context.issues.push({
      code: 'custom',
      path: ['PUBLIC_APP_URL'],
      message: `Must use https in ${NODE_ENV}`,
      input: PUBLIC_APP_URL,
    })
  }
  // The files are those of customers, and their URLs carry signatures.
  for (const [variable, endpoint] of Object.entries({
    STORAGE_ENDPOINT,
    STORAGE_PUBLIC_ENDPOINT,
  })) {
    if (!endpoint.startsWith('https://')) {
      context.issues.push({
        code: 'custom',
        path: [variable],
        message: `Must use https in ${NODE_ENV}`,
        input: endpoint,
      })
    }
  }
})

type SmtpTls = z.infer<typeof smtpTlsSchema>
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
  mail: {
    host: string
    port: number
    tls: SmtpTls
    user: string
    password: string
    /** The sender of every message. */
    from: string
  }
  /** The origin of the web application that the links in mails point at. */
  publicAppUrl: string
  twoFactor: {
    /** What the secrets of authenticator apps are encrypted under. */
    encryptionKey: string
  }
  /** The S3-compatible object storage that holds the files of the attachments. */
  storage: {
    /** Where the server reaches the storage. */
    endpoint: string
    /** Where a client reaches it: the URLs it is given name this host. */
    publicEndpoint: string
    region: string
    bucket: string
    accessKeyId: string
    secretAccessKey: string
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
  mail: {
    host: variables.SMTP_HOST,
    port: variables.SMTP_PORT,
    tls: variables.SMTP_TLS,
    user: variables.SMTP_USER,
    password: variables.SMTP_PASSWORD,
    from: variables.MAIL_FROM,
  },
  publicAppUrl: variables.PUBLIC_APP_URL,
  twoFactor: {
    encryptionKey: variables.TWO_FACTOR_ENCRYPTION_KEY,
  },
  storage: {
    endpoint: variables.STORAGE_ENDPOINT,
    publicEndpoint: variables.STORAGE_PUBLIC_ENDPOINT,
    region: variables.STORAGE_REGION,
    bucket: variables.STORAGE_BUCKET,
    accessKeyId: variables.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: variables.STORAGE_SECRET_ACCESS_KEY,
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
  const parsed = deployedVariablesSchema.safeParse(variables)

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
