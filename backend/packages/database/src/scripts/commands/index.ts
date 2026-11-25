import type { Command } from '../command'
import { checkApiConsistencyCommand } from './check-api-consistency'
import { generateSqlCommand } from './generate-sql'
import { introspectCommand } from './introspect'
import { migrateCommand } from './migrate'
import { resetCommand } from './reset'
import { seedCommand } from './seed'
import { setupCommand } from './setup'
import { truncateCommand } from './truncate'

/** The commands of the database, which `package.json` names. */
export const COMMANDS: readonly Command[] = [
  migrateCommand,
  setupCommand,
  resetCommand,
  seedCommand,
  truncateCommand,
  introspectCommand,
  generateSqlCommand,
  checkApiConsistencyCommand,
]
