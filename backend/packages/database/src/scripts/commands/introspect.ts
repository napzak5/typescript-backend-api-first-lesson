import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  type CatalogFacts,
  canonicalizeRelations,
  canonicalizeSchema,
} from '../canonicalize-introspection'
import {
  type Command,
  type CommandContext,
  dataOf,
  withDatabase,
} from '../command'
import { runProgram } from '../program'

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
const readCatalogFacts = (context: CommandContext): Promise<CatalogFacts> =>
  withDatabase(context, async (sql) => {
    const [uniqueConstraints, indexes] = await Promise.all([
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
    ])
    return {
      uniqueColumns: byKey(uniqueConstraints),
      indexOperatorClasses: byKey(indexes),
    }
  })

/**
 * A generated file as the repository formats it: without the imports
 * drizzle-kit emits but does not use, which the linter would reject. Biome
 * reads it as the file of the sources it is, with the settings of the
 * repository.
 */
const formatted = async (
  context: CommandContext,
  file: string,
  source: string,
): Promise<string> => {
  const options = { cwd: context.paths.package, env: context.env }
  const stdinFilePath = `--stdin-file-path=src/${file}`
  const linted = await runProgram(
    'pnpm',
    [
      'exec',
      'biome',
      'lint',
      '--write',
      '--unsafe',
      '--only=correctness/noUnusedImports',
      stdinFilePath,
    ],
    { ...options, input: source },
  )
  const checked = await runProgram(
    'pnpm',
    ['exec', 'biome', 'check', '--write', stdinFilePath],
    { ...options, input: linted.stdout },
  )
  return checked.stdout
}

/** Introspects the database into the folder, and writes the files to the sources. */
const introspectInto = async (
  context: CommandContext,
  directory: string,
): Promise<number> => {
  context.say('📝 Running drizzle-kit introspect...')
  const pulled = await runProgram(
    'pnpm',
    ['exec', 'drizzle-kit', 'introspect'],
    {
      cwd: context.paths.package,
      env: {
        ...context.env,
        DATABASE_URL: context.databaseUrl,
        INTROSPECTION_DIRECTORY: directory,
      },
      input: '',
    },
  )
  context.stdout.write(pulled.stdout)
  context.stderr.write(pulled.stderr)

  context.say('🧮 Rewriting the generated files into their canonical form...')
  const catalogFacts = await readCatalogFacts(context)
  const generated = (file: string): Promise<string> =>
    formatted(
      context,
      file,
      fs.readFileSync(path.join(directory, file), 'utf8'),
    )
  const schema = await formatted(
    context,
    'schema.ts',
    dataOf(canonicalizeSchema(await generated('schema.ts'), catalogFacts)),
  )
  const relations = await formatted(
    context,
    'relations.ts',
    dataOf(canonicalizeRelations(await generated('relations.ts'))),
  )
  fs.writeFileSync(path.join(context.paths.source, 'schema.ts'), schema)
  fs.writeFileSync(path.join(context.paths.source, 'relations.ts'), relations)

  context.say('✅ Introspection completed successfully!')
  context.say('Generated files:')
  context.say(`  - ${path.join(context.paths.source, 'schema.ts')}`)
  context.say(`  - ${path.join(context.paths.source, 'relations.ts')}`)
  return 0
}

/** `pnpm db:introspect`: generates `schema.ts` and `relations.ts` from the database. */
export const introspectCommand: Command = {
  name: 'introspect',
  help: `
Database Introspection

Usage: pnpm db:introspect

Generates src/schema.ts and src/relations.ts from the database with
drizzle-kit, in their canonical form: formatted, with what drizzle-kit reports
differently read from the catalog, and the relations sorted.
`,
  run: (context) => {
    context.say(
      `🔍 Starting database introspection in ${context.environment.toUpperCase()} environment...`,
    )
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'introspection-'))
    return introspectInto(context, directory).finally(() =>
      fs.rmSync(directory, { recursive: true, force: true }),
    )
  },
}
