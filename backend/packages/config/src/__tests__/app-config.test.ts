import * as fs from 'node:fs'
import * as path from 'node:path'
import * as dotenv from 'dotenv'
import { describe, expect, it } from 'vitest'
import { parseAppConfig } from '../app-config'

const variables = {
  NODE_ENV: 'production',
  HOST: '0.0.0.0',
  PORT: '3000',
  TRUST_PROXY_HOPS: '1',
  DATABASE_URL: 'postgres://app:hunter2@db.internal:5432/beauty_salon',
  DATABASE_POOL_MAX: '50',
  DATABASE_CONNECTION_TIMEOUT: '60000',
  CORS_ORIGIN: 'https://salon.example, https://admin.salon.example',
  CORS_CREDENTIALS: 'true',
  CORS_MAX_AGE: '86400',
  RATE_LIMIT_WINDOW_MS: '900000',
  RATE_LIMIT_MAX_REQUESTS: '100',
  SMTP_HOST: 'smtp.mail.example',
  SMTP_PORT: '587',
  SMTP_TLS: 'starttls',
  SMTP_USER: 'salon-api',
  SMTP_PASSWORD: 'hunter2',
  MAIL_FROM: 'Beauty Salon <no-reply@salon.example>',
  PUBLIC_APP_URL: 'https://salon.example',
  LOG_LEVEL: 'info',
  LOG_FORMAT: 'json',
}

const variableNames = Object.keys(variables)

/**
 * What docker-compose.yml and the database scripts read from an environment
 * file, next to the variables of the server.
 */
const databaseVariableNames = [
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_PORT',
  'DB_HOST',
]

const rootPath = path.resolve(import.meta.dirname, '../../../../..')

const readEnvFile = (file: string): Record<string, string> =>
  dotenv.parse(fs.readFileSync(path.join(rootPath, file)))

/**
 * What docker-compose.yml uses for a variable that nothing sets: the
 * `default` of its first `${NAME:-default}`.
 */
const composeDefault = (name: string): string | undefined =>
  new RegExp(`\\$\\{${name}:-([^}]*)\\}`).exec(
    fs.readFileSync(path.join(rootPath, 'docker-compose.yml'), 'utf8'),
  )?.[1]

describe('parseAppConfig', () => {
  it('should read every setting from the variables', () => {
    expect(parseAppConfig(variables)).toEqual({
      type: 'success',
      data: {
        environment: 'production',
        server: { host: '0.0.0.0', port: 3000, trustProxyHops: 1 },
        database: {
          url: 'postgres://app:hunter2@db.internal:5432/beauty_salon',
          poolMax: 50,
          connectTimeoutMs: 60000,
        },
        cors: {
          origins: ['https://salon.example', 'https://admin.salon.example'],
          credentials: true,
          maxAgeSeconds: 86400,
        },
        rateLimit: { windowMs: 900000, maxRequests: 100 },
        mail: {
          host: 'smtp.mail.example',
          port: 587,
          tls: 'starttls',
          user: 'salon-api',
          password: 'hunter2',
          from: 'Beauty Salon <no-reply@salon.example>',
        },
        publicAppUrl: 'https://salon.example',
        logging: { level: 'info', format: 'json' },
      },
    })
  })

  it('should ignore variables the server does not use', () => {
    expect(parseAppConfig({ ...variables, JWT_SECRET: 'unused' })).toEqual(
      parseAppConfig(variables),
    )
  })

  it('should report every missing variable at once', () => {
    const result = parseAppConfig({})

    expect(result).toMatchObject({ type: 'error' })
    expect(
      result.type === 'error' && result.error.map(({ variable }) => variable),
    ).toEqual(variableNames)
  })

  it.each([
    ['NODE_ENV', 'prod'],
    ['HOST', ''],
    ['PORT', ''],
    ['PORT', 'abc'],
    ['PORT', '0'],
    ['PORT', '65536'],
    ['PORT', '3000.5'],
    ['TRUST_PROXY_HOPS', '-1'],
    ['TRUST_PROXY_HOPS', 'true'],
    ['DATABASE_URL', 'not a url'],
    ['DATABASE_URL', 'mysql://app:hunter2@db.internal:3306/beauty_salon'],
    ['DATABASE_POOL_MAX', '0'],
    // Thirty seconds written in seconds instead of milliseconds
    ['DATABASE_CONNECTION_TIMEOUT', '30'],
    ['CORS_ORIGIN', ''],
    ['CORS_ORIGIN', '*'],
    ['CORS_ORIGIN', 'salon.example'],
    ['CORS_ORIGIN', 'https://salon.example/'],
    ['CORS_ORIGIN', 'https://salon.example,'],
    ['CORS_CREDENTIALS', 'yes'],
    ['CORS_MAX_AGE', '1 day'],
    ['RATE_LIMIT_WINDOW_MS', '60'],
    ['RATE_LIMIT_MAX_REQUESTS', '0'],
    ['LOG_LEVEL', 'verbose'],
    ['LOG_FORMAT', 'simple'],
  ])('should reject %s=%j', (variable, value) => {
    const result = parseAppConfig({ ...variables, [variable]: value })

    expect(result).toMatchObject({ type: 'error' })
    expect(
      result.type === 'error' && result.error.map((issue) => issue.variable),
    ).toEqual([variable])
  })

  it.each([
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_TLS',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'MAIL_FROM',
    'PUBLIC_APP_URL',
  ])('should report a missing %s by its name', (variable) => {
    const rest = Object.fromEntries(
      Object.entries(variables).filter(([name]) => name !== variable),
    )

    const result = parseAppConfig(rest)

    expect(
      result.type === 'error' && result.error.map((issue) => issue.variable),
    ).toEqual([variable])
  })

  it.each([
    ['SMTP_HOST', ''],
    ['SMTP_PORT', ''],
    ['SMTP_PORT', '0'],
    ['SMTP_PORT', '65536'],
    ['SMTP_PORT', 'smtp'],
    ['SMTP_PORT', '587.5'],
    ['SMTP_TLS', ''],
    ['SMTP_TLS', 'tls'],
    ['SMTP_TLS', 'ssl'],
    ['SMTP_TLS', 'true'],
    ['SMTP_USER', ''],
    ['SMTP_PASSWORD', ''],
    ['MAIL_FROM', ''],
    ['MAIL_FROM', 'no-reply'],
    ['MAIL_FROM', 'Beauty Salon'],
    ['MAIL_FROM', 'Beauty Salon <no-reply>'],
    ['MAIL_FROM', 'Beauty Salon <no-reply@salon.example> and more'],
    ['PUBLIC_APP_URL', ''],
    ['PUBLIC_APP_URL', 'salon.example'],
    ['PUBLIC_APP_URL', 'https://salon.example/'],
    ['PUBLIC_APP_URL', 'https://salon.example/app'],
    ['PUBLIC_APP_URL', 'https://salon.example?ref=mail'],
    ['PUBLIC_APP_URL', 'https://salon.example#top'],
    ['PUBLIC_APP_URL', 'https://user:secret@salon.example'],
  ])('should reject %s=%j by its name', (variable, value) => {
    const result = parseAppConfig({ ...variables, [variable]: value })

    expect(
      result.type === 'error' && result.error.map((issue) => issue.variable),
    ).toEqual([variable])
  })

  it.each([
    ['SMTP_PORT', '1', { mail: expect.objectContaining({ port: 1 }) }],
    ['SMTP_PORT', '65535', { mail: expect.objectContaining({ port: 65535 }) }],
    [
      'SMTP_TLS',
      'implicit',
      { mail: expect.objectContaining({ tls: 'implicit' }) },
    ],
    [
      'MAIL_FROM',
      'no-reply@salon.example',
      { mail: expect.objectContaining({ from: 'no-reply@salon.example' }) },
    ],
    [
      'MAIL_FROM',
      'ビューティーサロン青山 <no-reply@salon.example>',
      {
        mail: expect.objectContaining({
          from: 'ビューティーサロン青山 <no-reply@salon.example>',
        }),
      },
    ],
    [
      'PUBLIC_APP_URL',
      'https://book.salon.example:8443',
      { publicAppUrl: 'https://book.salon.example:8443' },
    ],
  ])('should accept %s=%j', (variable, value, expected) => {
    expect(parseAppConfig({ ...variables, [variable]: value })).toMatchObject({
      type: 'success',
      data: expected,
    })
  })

  it.each([
    ['SMTP_PORT', 'port-value-31337x'],
    ['SMTP_TLS', 'tls-value-31337'],
    ['MAIL_FROM', 'Sender <from-value-31337>'],
    ['PUBLIC_APP_URL', 'https://url-value-31337.example/path'],
  ])(
    'should keep the rejected value of %s out of the report',
    (variable, value) => {
      const result = parseAppConfig({ ...variables, [variable]: value })

      expect(result).toMatchObject({ type: 'error' })
      expect(JSON.stringify(result)).not.toContain('31337')
    },
  )

  describe.each(['staging', 'production'])('in %s', (environment) => {
    const deployed = { ...variables, NODE_ENV: environment }

    it('should refuse to send mail without encryption', () => {
      const result = parseAppConfig({ ...deployed, SMTP_TLS: 'none' })

      expect(
        result.type === 'error' && result.error.map((issue) => issue.variable),
      ).toEqual(['SMTP_TLS'])
    })

    it('should refuse links to the web application that are not https', () => {
      const result = parseAppConfig({
        ...deployed,
        PUBLIC_APP_URL: 'http://app-31337.salon.example',
      })

      expect(
        result.type === 'error' && result.error.map((issue) => issue.variable),
      ).toEqual(['PUBLIC_APP_URL'])
      expect(JSON.stringify(result)).not.toContain('31337')
    })

    it('should report both at once', () => {
      const result = parseAppConfig({
        ...deployed,
        SMTP_TLS: 'none',
        PUBLIC_APP_URL: 'http://salon.example',
      })

      expect(
        result.type === 'error' &&
          result.error.map((issue) => issue.variable).sort(),
      ).toEqual(['PUBLIC_APP_URL', 'SMTP_TLS'])
    })

    it.each(['implicit', 'starttls'])(
      'should accept SMTP_TLS=%s with an https link',
      (tls) => {
        expect(
          parseAppConfig({
            ...deployed,
            SMTP_TLS: tls,
            PUBLIC_APP_URL: 'https://salon.example',
          }),
        ).toMatchObject({ type: 'success' })
      },
    )
  })

  it.each(['localhost', 'development', 'test'])(
    'should accept unencrypted mail and an http link in %s',
    (environment) => {
      expect(
        parseAppConfig({
          ...variables,
          NODE_ENV: environment,
          SMTP_TLS: 'none',
          PUBLIC_APP_URL: 'http://localhost:3001',
        }),
      ).toMatchObject({
        type: 'success',
        data: {
          mail: expect.objectContaining({ tls: 'none' }),
          publicAppUrl: 'http://localhost:3001',
        },
      })
    },
  )

  it('should keep the rejected value out of the report', () => {
    const result = parseAppConfig({
      ...variables,
      DATABASE_URL: 'mysql://app:hunter2@db.internal:3306/beauty_salon',
    })

    expect(JSON.stringify(result)).not.toContain('hunter2')
  })
})

describe('environment files', () => {
  it.each([
    '.env.localhost',
    '.env.development',
    '.env.test',
    '.env.test.ci',
    '.env.staging',
    '.env.production',
    '.env.example',
  ])('%s should configure the server completely', (file) => {
    expect(parseAppConfig(readEnvFile(file))).toMatchObject({
      type: 'success',
    })
  })

  it('.env.test.ci should configure the server as production, which is how the Docker smoke test runs it', () => {
    expect(
      parseAppConfig({
        ...readEnvFile('.env.test.ci'),
        NODE_ENV: 'production',
      }),
    ).toMatchObject({ type: 'success' })
  })

  it.each(['.env.localhost', '.env.development'])(
    '%s should allow the origins of the three frontend applications',
    (file) => {
      expect(parseAppConfig(readEnvFile(file))).toMatchObject({
        type: 'success',
        data: {
          cors: {
            origins: [
              'http://localhost:3001',
              'http://localhost:3002',
              'http://localhost:3003',
            ],
          },
        },
      })
    },
  )

  describe.each([
    '.env.localhost',
    '.env.development',
    '.env.test',
    '.env.example',
  ])('the database of %s', (file) => {
    const env = readEnvFile(file)
    const url = new URL(env['DATABASE_URL'] ?? '')
    const database = {
      POSTGRES_USER: url.username,
      POSTGRES_PASSWORD: decodeURIComponent(url.password),
      POSTGRES_DB: url.pathname.slice(1),
      POSTGRES_PORT: url.port,
    }

    it('should be the same in DATABASE_URL and in the POSTGRES_* variables', () => {
      expect(env).toMatchObject(database)
    })

    it('should be the PostgreSQL that docker compose starts by default', () => {
      expect(database).toEqual({
        POSTGRES_USER: composeDefault('POSTGRES_USER'),
        POSTGRES_PASSWORD: composeDefault('POSTGRES_PASSWORD'),
        POSTGRES_DB: composeDefault('POSTGRES_DB'),
        POSTGRES_PORT: composeDefault('POSTGRES_PORT'),
      })
    })
  })

  it.each([
    '.env.localhost',
    '.env.development',
    '.env.test',
    '.env.test.ci',
    '.env.staging',
    '.env.production',
    '.env.example',
    '.env.template',
  ])('%s should set no variable that nothing reads', (file) => {
    const known = [...variableNames, ...databaseVariableNames]

    expect(
      Object.keys(readEnvFile(file)).filter((name) => !known.includes(name)),
    ).toEqual([])
  })

  it('.env.template should list every variable the server reads', () => {
    expect(Object.keys(readEnvFile('.env.template'))).toEqual(
      expect.arrayContaining(variableNames),
    )
  })
})
