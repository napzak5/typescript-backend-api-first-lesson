#!/usr/bin/env tsx

import { execSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { z } from 'zod'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const openApiPath = resolve(
  packageRoot,
  '../../../specs/tsp-output/@typespec/openapi3/generated/openapi.yaml',
)
const outputDir = join(packageRoot, 'src')
const tempOutput = join(outputDir, 'api-types-temp.ts')

/** The part of the OpenAPI document that this script reads itself. */
const documentSchema = z.object({
  components: z.object({
    schemas: z.record(z.string(), z.unknown()),
  }),
})

/** A string enum among `components.schemas`. */
const stringEnumSchema = z.object({
  type: z.literal('string'),
  enum: z.array(z.string()),
  description: z.string().optional(),
})

type StringEnum = {
  /** Name of the schema without the `Models.` prefix. */
  name: string
  values: string[]
  description: string | undefined
}

const readStringEnums = (): StringEnum[] => {
  const document = documentSchema.safeParse(
    parse(readFileSync(openApiPath, 'utf-8')),
  )
  if (!document.success) {
    console.error(`❌ Unexpected OpenAPI document at: ${openApiPath}`)
    console.error(z.prettifyError(document.error))
    process.exit(1)
  }

  return Object.entries(document.data.components.schemas).flatMap(
    ([key, schema]) => {
      const stringEnum = stringEnumSchema.safeParse(schema)
      return stringEnum.success
        ? [
            {
              name: key.split('.').pop() ?? key,
              values: stringEnum.data.enum,
              description: stringEnum.data.description,
            },
          ]
        : []
    },
  )
}

/**
 * Lays out an enum description for the hover text of an editor: the lines
 * that describe a value (`value: text`) are separated by an empty line, and
 * the first of them from the heading by two.
 */
const formatEnumDescription = (description: string): string => {
  const lines = description
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')

  const formatted: string[] = []
  let inHeading = true
  for (const line of lines) {
    if (/^[A-Za-z0-9_]+:/.test(line)) {
      formatted.push(...(inHeading ? ['', ''] : ['']))
      inHeading = false
    }
    formatted.push(line)
  }

  return formatted.join('\n')
}

/** The `@description` lines of a JSDoc comment, each starting with `indent`. */
const descriptionLines = (description: string, indent: string): string =>
  [
    `${indent} * @description\n`,
    ...formatEnumDescription(description)
      .split('\n')
      .map((line) => (line === '' ? `${indent} *\n` : `${indent} * ${line}\n`)),
  ].join('')

/**
 * `api-types.ts`: the output of openapi-typescript, with the JSDoc of every
 * described enum replaced by one that puts each value on a line of its own.
 */
const apiTypesFile = (baseTypes: string, enums: StringEnum[]): string => {
  const types = enums.reduce((result, { name, description }) => {
    if (description === undefined || description === '') {
      return result
    }

    const property = `"Models.${name}"`
    const documentedProperty = new RegExp(
      `(\\s*)/\\*\\*[^*]*\\*+(?:[^/*][^*]*\\*+)*/\\s*${property.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}:`,
      'gm',
    )

    return result.replace(
      documentedProperty,
      (_match: string, indent: string) =>
        `${indent}/**\n${descriptionLines(description, indent)}${indent} * @enum {string}\n${indent} */\n${indent}${property}:`,
    )
  }, baseTypes)

  return `// Generated from TypeSpec/OpenAPI using openapi-typescript
// DO NOT EDIT MANUALLY

// Base types from OpenAPI
${types}
`
}

/** A Zod schema and the type inferred from it, both with the enum's JSDoc. */
const zodEnum = ({ name, values, description }: StringEnum): string => {
  const jsDoc =
    description === undefined || description === ''
      ? ''
      : `/**\n${descriptionLines(description, '')} */\n`
  const inline = values.map((value) => `'${value}'`).join(', ')
  const list =
    inline.length > 80
      ? `[\n${values.map((value) => `  '${value}'`).join(',\n')}\n]`
      : `[${inline}]`

  return `${jsDoc}export const ${name}Schema = z.enum(${list})\n${jsDoc}export type ${name} = z.infer<typeof ${name}Schema>\n\n`
}

/** `schema.ts`: a Zod schema for every string enum of the document. */
const schemaFile = (enums: StringEnum[]): string =>
  `import { z } from 'zod'\n\n${enums.map(zodEnum).join('')}`

const indexFile = `// Generated from TypeSpec/OpenAPI
// DO NOT EDIT MANUALLY

// Main API types and utilities
export * from './api-types';

// Zod validation schemas
export * from './schema';
`

if (!existsSync(openApiPath)) {
  console.error(`❌ OpenAPI file not found at: ${openApiPath}`)
  console.error('Please run "pnpm generate:spec" first')
  process.exit(1)
}

mkdirSync(outputDir, { recursive: true })

console.log('🔧 Generating types from OpenAPI specification...')
console.log(`📄 Input: ${openApiPath}`)
console.log(`📁 Output: ${outputDir}`)

try {
  execSync(`npx openapi-typescript "${openApiPath}" -o "${tempOutput}"`, {
    stdio: 'inherit',
    cwd: packageRoot,
  })
} catch (error) {
  console.error('❌ Failed to generate types:', error)
  process.exit(1)
}

const enums = readStringEnums()

writeFileSync(
  join(outputDir, 'api-types.ts'),
  apiTypesFile(readFileSync(tempOutput, 'utf-8'), enums),
)
rmSync(tempOutput, { force: true })
writeFileSync(join(outputDir, 'schema.ts'), schemaFile(enums))
writeFileSync(join(outputDir, 'index.ts'), indexFile)

console.log('✅ Type generation complete!')
console.log(`📦 Generated files in: ${outputDir}`)
console.log('  - api-types.ts')
console.log('  - schema.ts')
console.log('  - index.ts')
