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
export const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
)

/** The variables of the environment of a process, as `process.env` holds them. */
type Variables = Record<string, string | undefined>

export type LoadedEnvFile = {
  environment: Environment
  /** Name of the file that was read; null when none exists. */
  file: string | null
}

const loadFile = (
  directory: string,
  file: string,
  variables: Variables,
): string | null => {
  const filePath = path.join(directory, file)
  if (!fs.existsSync(filePath)) {
    return null
  }
  dotenv.config({ path: filePath, processEnv: variables, quiet: true })
  return file
}

/**
 * Reads the environment file of a directory into the variables. Variables
 * that are already set win, so a deployment configures the process directly
 * and needs no file.
 *
 * The environment is `NODE_ENV`, or `localhost` when that is unset or
 * unknown. `.env` is read when it exists; otherwise `.env.<environment>`.
 */
export const loadEnvFileFrom = (
  directory: string,
  variables: Variables,
): LoadedEnvFile => {
  const { NODE_ENV } = variables
  const environment = environmentSchema.catch('localhost').parse(NODE_ENV)

  return {
    environment,
    file:
      loadFile(directory, '.env', variables) ??
      loadFile(directory, `.env.${environment}`, variables),
  }
}

/**
 * Reads the environment file of the repository into the variables: those of
 * the process (`process.env`) when the server or a database script starts.
 */
export const loadEnvFile = (variables: Variables): LoadedEnvFile =>
  loadEnvFileFrom(REPOSITORY_ROOT, variables)

/**
 * The connection URL of the database commands: `DATABASE_URL`, else one put
 * together from its parts, each of which defaults to the database of local
 * development.
 */
export const databaseUrlOf = (variables: Variables): string => {
  const {
    DATABASE_URL,
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    DB_HOST,
    POSTGRES_PORT,
    POSTGRES_DB,
  } = variables

  return (
    DATABASE_URL ||
    `postgres://${POSTGRES_USER || 'postgres'}:${
      POSTGRES_PASSWORD || 'postgres'
    }@${DB_HOST || 'localhost'}:${POSTGRES_PORT || 5432}/${
      POSTGRES_DB || 'beauty_salon'
    }`
  )
}
