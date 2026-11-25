import { randomBytes } from 'node:crypto'
import postgres from 'postgres'

/** A database of a test: a copy of the template of its set. */
export interface TestDatabase {
  /** Its name, which begins with the prefix of its set. */
  readonly name: string
  /** Its URL, with the role of the instance. */
  readonly url: string
  /** A connection to it, which `drop` ends. */
  readonly client: postgres.Sql
  /** Another connection to it, which the caller ends. */
  connect(): postgres.Sql
  /** Ends the connection, and drops the database with whatever is still connected to it. */
  drop(): Promise<void>
}

/** The databases of the tests, on one instance. */
export interface TestDatabases {
  /** A database of a test's own: a copy of the template. */
  create(): Promise<TestDatabase>
  /** Drops the template, once the databases made from it are dropped. */
  close(): Promise<void>
}

export interface TestDatabaseOptions {
  /**
   * What the names of the databases begin with, to tell whose they are:
   * the tests of every package make theirs on one instance in CI. A name
   * has at most 63 characters, and the rest of it takes 22.
   */
  readonly prefix: string
  /** The SQL of the schema that every database has; none when absent. */
  readonly schema?: string
  /**
   * The rows that every database starts with, written into the template
   * after the schema, over the connection given; none when absent.
   */
  readonly fill?: (template: postgres.Sql) => Promise<void>
}

/**
 * What PostgreSQL says by the way (a table that a `DROP TABLE IF EXISTS`
 * did not find) is not written into the output of the tests.
 */
const QUIET = { onnotice: () => undefined }

/**
 * Gives every test a database of its own on the instance at `instanceUrl`.
 *
 * What every database starts with (`schema`, `fill`) is written once, into
 * a template; the database of a test is a copy of it, which PostgreSQL makes
 * in a fraction of the time it takes to write it again. A database can
 * only be copied while nothing is connected to it, so the connection that
 * fills the template is closed before the first copy.
 *
 * The databases of a call share a mark of their own after the prefix:
 * other calls on the same instance, in this process or in another, make
 * and drop theirs meanwhile.
 *
 * The role of `instanceUrl` needs the right to create databases.
 */
export const openTestDatabases = async (
  instanceUrl: string,
  { prefix, schema = '', fill = async () => undefined }: TestDatabaseOptions,
): Promise<TestDatabases> => {
  const admin = postgres(instanceUrl, { max: 1, ...QUIET })
  const urlOf = (database: string): string => {
    const url = new URL(instanceUrl)
    url.pathname = `/${database}`
    return url.toString()
  }

  const set = `${prefix}_${randomBytes(6).toString('hex')}`
  const template = `${set}_template`
  await admin`CREATE DATABASE ${admin(template)}`
  const filling = postgres(urlOf(template), { max: 1, ...QUIET })
  await filling.unsafe(schema)
  await fill(filling)
  await filling.end()

  let made = 0

  return {
    create: async () => {
      made += 1
      const name = `${set}_${made}`
      await admin`CREATE DATABASE ${admin(name)} TEMPLATE ${admin(template)}`
      const connect = (): postgres.Sql => postgres(urlOf(name), QUIET)
      const client = connect()

      return {
        name,
        url: urlOf(name),
        client,
        connect,
        drop: async () => {
          await client.end()
          await admin`DROP DATABASE ${admin(name)} WITH (FORCE)`
        },
      }
    },
    close: async () => {
      await admin`DROP DATABASE ${admin(template)}`
      await admin.end()
    },
  }
}
