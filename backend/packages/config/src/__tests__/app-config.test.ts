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
  LOG_LEVEL: 'info',
  LOG_FORMAT: 'json',
}

const variableNames = Object.keys(variables)

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

  it('.env.template should list every variable the server reads', () => {
    expect(Object.keys(readEnvFile('.env.template'))).toEqual(
      expect.arrayContaining(variableNames),
    )
  })
})
