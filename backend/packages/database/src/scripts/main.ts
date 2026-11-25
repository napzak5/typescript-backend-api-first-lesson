import { PACKAGE_PATHS, runCommand } from './command'
import { COMMANDS } from './commands/index'

/**
 * The entry of the commands of the database (`pnpm db:migrate`, …,
 * `pnpm check:api-db`): the command its first argument names, in the process
 * of Node.js.
 */
process.exitCode = await runCommand(
  COMMANDS,
  process.argv.slice(2),
  process,
  PACKAGE_PATHS,
)
