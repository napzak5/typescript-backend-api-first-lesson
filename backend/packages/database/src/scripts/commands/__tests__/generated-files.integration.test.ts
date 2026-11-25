import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useTestDatabases } from '@beauty-salon-backend/testing'
import { describe, expect, it } from 'vitest'
import { runDatabaseCommand } from '../../__tests__/_shared/commands'
import { useTemporaryFolders } from '../../__tests__/_shared/folders'
import { PACKAGE_PATHS } from '../../command'

const databases = useTestDatabases({ prefix: 'database_test' })
const folderOf = useTemporaryFolders()

/**
 * The variables of the test process, with the database of the test: drizzle-kit
 * and Biome are found on its PATH, as they are when `pnpm` runs a command.
 */
const variables = (databaseUrl = databases.url()) => ({
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
})

/** A file of the package, as it is committed. */
const committed = (...parts: string[]): string =>
  readFileSync(join(PACKAGE_PATHS.package, ...parts), 'utf8')

// drizzle-kit and Biome run as programs of their own, and each takes seconds
const PROGRAMS = { timeout: 120_000 }

describe('pnpm db:introspect', () => {
  it(
    'should generate from a database made from setup.sql the schema and the relations that are committed',
    PROGRAMS,
    async () => {
      // Arrange
      await runDatabaseCommand(['migrate'], variables())
      const source = folderOf({})

      // Act
      const introspected = await runDatabaseCommand(
        ['introspect'],
        variables(),
        { source },
      )

      // Assert
      expect(introspected.status).toBe(0)
      expect(introspected.stdout).toContain(
        '✅ Introspection completed successfully!',
      )
      expect(readFileSync(join(source, 'schema.ts'), 'utf8')).toBe(
        committed('src', 'schema.ts'),
      )
      expect(readFileSync(join(source, 'relations.ts'), 'utf8')).toBe(
        committed('src', 'relations.ts'),
      )
      expect(existsSync(join(PACKAGE_PATHS.package, 'migrations'))).toBe(false)
    },
  )

  it(
    'should leave out the imports that drizzle-kit writes and the files do not use',
    PROGRAMS,
    async () => {
      // Arrange
      await databases.client()`CREATE TABLE salons (id uuid PRIMARY KEY, name text NOT NULL)`
      const source = folderOf({})

      // Act
      const introspected = await runDatabaseCommand(
        ['introspect'],
        variables(),
        { source },
      )

      // Assert
      expect(introspected.status).toBe(0)
      expect(readFileSync(join(source, 'schema.ts'), 'utf8')).toBe(
        `import { pgTable, text, uuid } from 'drizzle-orm/pg-core'

export const salons = pgTable('salons', {
  id: uuid().primaryKey().notNull(),
  name: text().notNull(),
})
`,
      )
      expect(readFileSync(join(source, 'relations.ts'), 'utf8')).toBe('')
    },
  )

  it(
    'should fail on a database that does not exist, tell why, and write nothing',
    PROGRAMS,
    async () => {
      // Arrange
      const source = folderOf({})
      const missing = new URL(databases.url())
      missing.pathname = '/no_such_database'

      // Act
      const introspected = await runDatabaseCommand(
        ['introspect'],
        variables(missing.toString()),
        { source },
      )

      // Assert
      expect(introspected.status).toBe(1)
      expect(introspected.stderr).toContain(
        '❌ introspect failed: Error: pnpm exec drizzle-kit introspect ended with',
      )
      expect(existsSync(join(source, 'schema.ts'))).toBe(false)
    },
  )
})

describe('pnpm db:generate-sql', () => {
  it(
    'should generate from the schema the setup.sql that is committed',
    PROGRAMS,
    async () => {
      // Arrange
      const sql = join(folderOf({}), 'sql')

      // Act
      const generated = await runDatabaseCommand(
        ['generate-sql'],
        variables(),
        {
          sql,
        },
      )

      // Assert
      expect(generated.status).toBe(0)
      expect(generated.stdout).toContain('✅ Successfully generated setup.sql!')
      expect(readFileSync(join(sql, 'setup.sql'), 'utf8')).toBe(
        committed('sql', 'setup.sql'),
      )
    },
  )

  it(
    'should refuse a schema without tables, and write nothing',
    PROGRAMS,
    async () => {
      // Arrange
      const source = folderOf({ 'schema.ts': 'export const nothing = 1\n' })
      const sql = join(folderOf({}), 'sql')

      // Act
      const generated = await runDatabaseCommand(
        ['generate-sql'],
        variables(),
        {
          source,
          sql,
        },
      )

      // Assert
      expect(generated.status).toBe(1)
      expect(generated.stderr).toContain(
        `❌ No SQL was generated from ${join(source, 'schema.ts')}: it has no tables`,
      )
      expect(existsSync(sql)).toBe(false)
    },
  )
})
