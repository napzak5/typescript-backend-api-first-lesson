import * as path from 'node:path'
import { inspect } from 'node:util'
import {
  databaseUrlOf,
  type Environment,
  loadEnvFile,
} from '@beauty-salon-backend/config'
import type { Result } from '@beauty-salon-backend/utility'
import postgres from 'postgres'

/** Where a command writes: a stream of the process, or what a test reads. */
interface Output {
  write(text: string): unknown
}

/** The files and folders a command reads and writes. */
export interface CommandPaths {
  /** The package, where drizzle-kit and Biome run */
  readonly package: string
  /** The sources, with `schema.ts` and `relations.ts` */
  readonly source: string
  /** The SQL: `setup.sql` and `migrations/` */
  readonly sql: string
  /** The OpenAPI document that is generated from the contract */
  readonly openApi: string
}

/** Those of this package. */
export const PACKAGE_PATHS: CommandPaths = {
  package: path.resolve(import.meta.dirname, '../..'),
  source: path.resolve(import.meta.dirname, '..'),
  sql: path.resolve(import.meta.dirname, '../../sql'),
  openApi: path.resolve(
    import.meta.dirname,
    '../../../../../specs/tsp-output/@typespec/openapi3/generated/openapi.yaml',
  ),
}

/**
 * What a command takes of the process it runs in: `process` of Node.js, or
 * what a test gives in its place.
 */
export interface CommandProcess {
  /** The variables of the environment; the environment file adds to them */
  readonly env: Record<string, string | undefined>
  readonly stdout: Output
  readonly stderr: Output
}

/** What a command runs with. */
export interface CommandContext {
  /** The arguments after the name of the command */
  readonly args: readonly string[]
  readonly environment: Environment
  /** The variables of the environment, for the programs a command runs */
  readonly env: Record<string, string | undefined>
  readonly databaseUrl: string
  readonly paths: CommandPaths
  readonly stdout: Output
  readonly stderr: Output
  /** Writes a line to the standard output. */
  say(line: string): void
  /** Writes a line to the standard error. */
  complain(line: string): void
}

/** A command of the database: `pnpm db:migrate` and the others. */
export interface Command {
  readonly name: string
  /** What `--help` writes */
  readonly help: string
  /**
   * Runs the command: the status the process ends with. What fails on the
   * way rejects, and the runner tells it.
   */
  run(context: CommandContext): Promise<number>
}

const HELP = new Set(['--help', '-h'])

/**
 * Runs the command the arguments name, with the arguments after its name, in
 * the environment of the process and its environment file: the status the
 * process ends with. `--help` writes what the command does, and runs
 * nothing.
 */
export const runCommand = async (
  commands: readonly Command[],
  argv: readonly string[],
  process: CommandProcess,
  paths: CommandPaths,
): Promise<number> => {
  const [name, ...args] = argv
  const command = commands.find((candidate) => candidate.name === name)
  if (command === undefined) {
    process.stderr.write(
      `❌ No command "${argv.join(' ')}". The commands: ${commands.map((candidate) => candidate.name).join(', ')}\n`,
    )
    return 1
  }
  if (args.some((arg) => HELP.has(arg))) {
    process.stdout.write(command.help)
    return 0
  }

  const { environment } = loadEnvFile(process.env)
  const context: CommandContext = {
    args,
    environment,
    env: process.env,
    databaseUrl: databaseUrlOf(process.env),
    paths,
    stdout: process.stdout,
    stderr: process.stderr,
    say: (line) => process.stdout.write(`${line}\n`),
    complain: (line) => process.stderr.write(`${line}\n`),
  }
  return command.run(context).catch((error: unknown) => {
    context.complain(`❌ ${command.name} failed: ${inspect(error)}`)
    return 1
  })
}

/** The value of a result; its error is a failure of the command. */
export const dataOf = <T>(result: Result<T, string>): T => {
  if (result.type === 'error') {
    throw new Error(result.error)
  }
  return result.data
}

/** The URL of the database as it is told: without its password. */
export const shownUrl = (url: string): string =>
  url.replace(/:[^:@/]+@/, ':***@')

/**
 * Does the work over one connection to the database of the command, which it
 * closes afterwards. What the database notes is written to the standard
 * output.
 */
export const withDatabase = <T>(
  context: CommandContext,
  work: (sql: postgres.Sql) => Promise<T>,
): Promise<T> => {
  context.say(`📊 Database URL: ${shownUrl(context.databaseUrl)}`)
  const sql = postgres(context.databaseUrl, {
    max: 1,
    onnotice: ({ message }) => context.say(`  ℹ️  ${message}`),
  })
  return work(sql).finally(() => sql.end())
}
