import { SETUP_SQL } from './sql-content'

/**
 * The schema of the application as SQL: every type, table, index and
 * constraint (`sql/setup.sql`, generated from the Drizzle schema).
 */
export function getSetupSql(): string {
  return SETUP_SQL
}
