import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The schema of the application as SQL: every type, table, index and
 * constraint (`sql/setup.sql`, generated from the Drizzle schema). It is read
 * when it is asked for, from the folder of the package, which lies one folder
 * above this module and above the bundle the build makes of it
 * (`dist/index.js`).
 */
export const getSetupSql = (): string =>
  readFileSync(join(import.meta.dirname, '..', 'sql', 'setup.sql'), 'utf8')
