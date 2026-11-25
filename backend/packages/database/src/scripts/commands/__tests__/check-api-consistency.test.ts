import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { z } from 'zod'
import { runDatabaseCommand } from '../../__tests__/_shared/commands'
import { useTemporaryFolders } from '../../__tests__/_shared/folders'
import { modelRules } from '../../api-consistency-rules'
import { PACKAGE_PATHS } from '../../command'

const folderOf = useTemporaryFolders()

/** What the test changes of the OpenAPI document that is generated from the contract. */
const generatedDocumentSchema = z.looseObject({
  components: z.looseObject({
    schemas: z.record(
      z.string(),
      z.looseObject({
        properties: z.record(z.string(), z.unknown()).optional(),
      }),
    ),
  }),
})

const generatedDocument = () =>
  generatedDocumentSchema.parse(
    parse(readFileSync(PACKAGE_PATHS.openApi, 'utf8')),
  )

/** Checks the document of the text: JSON, which YAML reads as well. */
const checkDocument = (text: string) => {
  const openApi = join(folderOf({}), 'openapi.yaml')
  writeFileSync(openApi, text)
  return runDatabaseCommand(['check-api-consistency'], {}, { openApi })
}

describe('pnpm check:api-db', () => {
  it('should pass the document that is generated from the contract', async () => {
    // Act
    const checked = await runDatabaseCommand(['check-api-consistency'], {})

    // Assert
    expect(checked).toEqual({
      status: 0,
      stdout: `${modelRules.length} API models agree with the database.\n`,
      stderr: '',
    })
  })

  it('should fail on a model that disagrees with its table, naming the difference', async () => {
    // Arrange
    const document = generatedDocument()
    const salon = document.components.schemas['Models.SalonResponse']
    const changed = {
      ...document,
      components: {
        ...document.components,
        schemas: {
          ...document.components.schemas,
          'Models.SalonResponse': {
            ...salon,
            properties: {
              ...salon?.properties,
              notAColumn: { type: 'string' },
            },
          },
        },
      },
    }

    // Act
    const checked = await checkDocument(JSON.stringify(changed))

    // Assert
    expect(checked.status).toBe(1)
    expect(checked.stderr).toMatch(
      /^API models that disagree with the database:\n/,
    )
    expect(checked.stderr).toContain(
      '  - Models.SalonResponse.notAColumn has no column in the table\n',
    )
    expect(checked.stderr).toContain('The database is the source of truth')
  })

  it('should fail on a document without the models of the rules, naming the rules', async () => {
    // Act
    const checked = await checkDocument(
      JSON.stringify({ components: { schemas: {} } }),
    )

    // Assert
    expect(checked.status).toBe(1)
    expect(checked.stderr).toContain(
      'Rules in api-consistency-rules.ts that match nothing:\n  - Models.SalonResponse: no such model in the OpenAPI document\n',
    )
  })

  it('should fail on a document it cannot read, naming it', async () => {
    // Act
    const checked = await checkDocument('components: none')

    // Assert
    expect(checked.status).toBe(1)
    expect(checked.stderr).toMatch(/^Cannot read .*openapi\.yaml: /)
  })
})
