import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as dotenv from 'dotenv'
import { type Environment, environmentSchema } from './environment'

/**
 * The repository root, where the `.env` files are. Derived from the module
 * URL because drizzle-kit loads this file through a bundler that provides
 * nothing else of `import.meta`.
 */
const rootPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
)

export type LoadedEnvFile = {
  environment: Environment
  /** Name of the file that was read; null when none exists. */
  file: string | null
}

const loadFile = (file: string): string | null => {
  const filePath = path.join(rootPath, file)
  if (!fs.existsSync(filePath)) {
    return null
  }
  dotenv.config({ path: filePath, quiet: true })
  return file
}

/**
 * Reads the environment file into `process.env`. Variables that are already
 * set win, so a deployment configures the process directly and needs no file.
 *
 * The environment is `NODE_ENV`, or `localhost` when that is unset or
 * unknown. `.env` is read when it exists; otherwise `.env.<environment>`.
 */
export const loadEnvFile = (): LoadedEnvFile => {
  const { NODE_ENV } = process.env
  const environment = environmentSchema.catch('localhost').parse(NODE_ENV)

  return {
    environment,
    file: loadFile('.env') ?? loadFile(`.env.${environment}`),
  }
}

/** Reads the environment file and returns the environment it belongs to. */
export const loadEnvConfig = (): Environment => loadEnvFile().environment

/** Connection URL for the database scripts. */
export const getDatabaseUrl = (): string => {
  const {
    DATABASE_URL,
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    DB_HOST,
    POSTGRES_PORT,
    POSTGRES_DB,
  } = process.env

  return (
    DATABASE_URL ||
    `postgres://${POSTGRES_USER || 'postgres'}:${
      POSTGRES_PASSWORD || 'postgres'
    }@${DB_HOST || 'localhost'}:${POSTGRES_PORT || 5432}/${
      POSTGRES_DB || 'beauty_salon'
    }`
  )
}
