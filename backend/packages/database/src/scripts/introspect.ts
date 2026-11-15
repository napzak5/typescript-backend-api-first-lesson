#!/usr/bin/env tsx
import { exec } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { promisify } from 'node:util'
import { getDatabaseUrl, loadEnvConfig } from '@beauty-salon-backend/config'
import { Result } from '@beauty-salon-backend/utility'
import postgres from 'postgres'
import {
  type CatalogFacts,
  canonicalizeRelations,
  canonicalizeSchema,
} from './canonicalize-introspection'

const execAsync = promisify(exec)

const packageDir = path.resolve(import.meta.dirname, '../..')
const migrationsDir = path.join(packageDir, 'migrations')
const schemaPath = path.join(packageDir, 'src/schema.ts')
const relationsPath = path.join(packageDir, 'src/relations.ts')

// Load environment-specific configuration
const environment = loadEnvConfig()

type CatalogRow = { key: string; names: string[] }

const byKey = (rows: readonly CatalogRow[]): Map<string, string[]> =>
  new Map(rows.map(({ key, names }) => [key, names]))

/**
 * Reads from the catalog what drizzle-kit reports differently:
 * - the columns of every unique constraint in declaration order. drizzle-kit
 *   lists them alphabetically, which is not the order the constraint (and
 *   its backing index) was created with.
 * - the operator class of every column of every index. drizzle-kit repeats
 *   the class of the first column for the others.
 */
async function readCatalogFacts(
  databaseUrl: string,
): Promise<Result<CatalogFacts, Error>> {
  const sql = postgres(databaseUrl, { max: 1 })
  const facts = await Result.fromPromise(
    Promise.all([
      sql<CatalogRow[]>`
        SELECT
          rel.relname || '.' || con.conname AS key,
          array_agg(att.attname::text ORDER BY cols.position) AS names
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        CROSS JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS cols(attnum, position)
        JOIN pg_attribute att
          ON att.attrelid = con.conrelid AND att.attnum = cols.attnum
        WHERE con.contype = 'u' AND nsp.nspname = 'public'
        GROUP BY rel.relname, con.conname
      `,
      sql<CatalogRow[]>`
        SELECT
          rel.relname || '.' || idx.relname AS key,
          array_agg(opc.opcname::text ORDER BY classes.position) AS names
        FROM pg_index ind
        JOIN pg_class idx ON idx.oid = ind.indexrelid
        JOIN pg_class rel ON rel.oid = ind.indrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        CROSS JOIN LATERAL unnest(ind.indclass::oid[]) WITH ORDINALITY AS classes(oid, position)
        JOIN pg_opclass opc ON opc.oid = classes.oid
        WHERE nsp.nspname = 'public'
        GROUP BY rel.relname, idx.relname
      `,
    ]),
  )
  await sql.end()
  return Result.map(facts, ([uniqueConstraints, indexes]) => ({
    uniqueColumns: byKey(uniqueConstraints),
    indexOperatorClasses: byKey(indexes),
  }))
}

/**
 * Formats the generated files and drops the imports drizzle-kit emits but does
 * not use, which the linter would otherwise reject.
 */
async function formatGeneratedFiles(): Promise<void> {
  const files = 'src/schema.ts src/relations.ts'
  await execAsync(
    `pnpm exec biome lint --write --unsafe --only=correctness/noUnusedImports ${files}`,
    { cwd: packageDir },
  )
  await execAsync(`pnpm exec biome check --write ${files}`, {
    cwd: packageDir,
  })
}

async function main() {
  console.log(
    `🔍 Starting database introspection in ${environment.toUpperCase()} environment...`,
  )
  console.log('This will generate schema.ts and relations.ts from the database')
  console.log('')

  // Get database URL from environment
  const databaseUrl = getDatabaseUrl()

  console.log('📊 Database URL:', databaseUrl.replace(/:[^:@]+@/, ':***@')) // Hide password in logs

  try {
    // Run Drizzle introspection
    console.log('📝 Running drizzle-kit introspect...')
    const { stdout, stderr } = await execAsync('pnpm drizzle-kit introspect', {
      cwd: packageDir,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
    })

    if (stdout) {
      console.log(stdout)
    }
    if (stderr) {
      console.error(stderr)
    }

    console.log('📦 Moving generated files to src/...')
    fs.copyFileSync(path.join(migrationsDir, 'schema.ts'), schemaPath)
    fs.copyFileSync(path.join(migrationsDir, 'relations.ts'), relationsPath)

    console.log('🧹 Cleaning up temporary migrations directory...')
    fs.rmSync(migrationsDir, { recursive: true, force: true })

    console.log('🧮 Rewriting the generated files into their canonical form...')
    await formatGeneratedFiles()
    const catalogFacts = await readCatalogFacts(databaseUrl)
    if (catalogFacts.type === 'error') {
      console.error(
        '❌ Failed to read constraints and indexes from the catalog:',
        catalogFacts.error,
      )
      process.exit(1)
    }
    const schema = canonicalizeSchema(
      fs.readFileSync(schemaPath, 'utf8'),
      catalogFacts.data,
    )
    const relations = canonicalizeRelations(
      fs.readFileSync(relationsPath, 'utf8'),
    )
    if (schema.type === 'error' || relations.type === 'error') {
      console.error(
        '❌ Failed to canonicalize the introspection result:',
        schema.type === 'error' ? schema.error : '',
        relations.type === 'error' ? relations.error : '',
      )
      process.exit(1)
    }
    fs.writeFileSync(schemaPath, schema.data)
    fs.writeFileSync(relationsPath, relations.data)
    await formatGeneratedFiles()

    console.log('✅ Introspection completed successfully!')
    console.log('')
    console.log('Generated files:')
    console.log('  - backend/packages/database/src/schema.ts')
    console.log('  - backend/packages/database/src/relations.ts')
  } catch (error) {
    console.error('❌ Introspection failed:', error)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err)
  process.exit(1)
})
