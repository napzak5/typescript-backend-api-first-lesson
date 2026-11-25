import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getSetupSql } from '../setup-sql'

describe('getSetupSql', () => {
  it('should give the setup.sql of the package, which creates the schema', () => {
    // Act
    const setupSql = getSetupSql()

    // Assert
    expect(setupSql).toBe(
      readFileSync(join(import.meta.dirname, '../../sql/setup.sql'), 'utf8'),
    )
    expect(setupSql).toContain('CREATE TABLE "salons"')
  })
})
