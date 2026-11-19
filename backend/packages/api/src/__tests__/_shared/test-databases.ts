import { randomUUID } from 'node:crypto'
import { getSetupSql } from '@beauty-salon-backend/database'
import {
  createDatabase,
  type Database,
} from '@beauty-salon-backend/infrastructure'
import postgres from 'postgres'

export type TestDatabase = {
  db: Database
  queryClient: postgres.Sql
  drop: () => Promise<void>
}

export type TestDatabases = {
  /** A database of the test's own: a copy of the template. */
  create: () => Promise<TestDatabase>
  close: () => Promise<void>
}

const uniqueName = (prefix: string): string =>
  `${prefix}_${randomUUID().replaceAll('-', '')}`

/**
 * Gives every test a database of its own on the instance at `instanceUrl`.
 *
 * The schema of the application (`sql/setup.sql`) is applied once, to a
 * template; the database of a test is a copy of it, which PostgreSQL makes in
 * a fraction of the time it takes to apply the schema again. A database can
 * only be copied while nothing is connected to it, so the connection that
 * builds the template is closed before the first copy.
 *
 * The tables of the template are empty unless `fillTemplate` puts rows in
 * them, over the connection it is given: every copy then starts with those
 * rows.
 *
 * The role of `instanceUrl` needs the right to create databases.
 */
export const openTestDatabases = async (
  instanceUrl: string,
  fillTemplate: (template: postgres.Sql) => Promise<void> = async () =>
    undefined,
): Promise<TestDatabases> => {
  const admin = postgres(instanceUrl, { max: 1 })
  const urlOf = (database: string): string => {
    const url = new URL(instanceUrl)
    url.pathname = `/${database}`
    return url.toString()
  }

  const template = uniqueName('api_test_template')
  await admin.unsafe(`CREATE DATABASE ${template}`)
  const setup = postgres(urlOf(template), {
    max: 1,
    onnotice: () => undefined,
  })
  await setup.unsafe(getSetupSql())
  await fillTemplate(setup)
  await setup.end()

  return {
    create: async () => {
      const name = uniqueName('api_test')
      await admin.unsafe(`CREATE DATABASE ${name} TEMPLATE ${template}`)
      const queryClient = postgres(urlOf(name))

      return {
        db: createDatabase(queryClient),
        queryClient,
        drop: async () => {
          await queryClient.end()
          await admin.unsafe(`DROP DATABASE ${name} WITH (FORCE)`)
        },
      }
    },
    close: async () => {
      await admin.unsafe(`DROP DATABASE ${template}`)
      await admin.end()
    },
  }
}
