import { type CommandPaths, PACKAGE_PATHS, runCommand } from '../../command'
import { COMMANDS } from '../../commands/index'

/** What a command did: the status it ended with, and what it wrote. */
export type CommandRun = { status: number; stdout: string; stderr: string }

/**
 * Runs a command of the package as `pnpm db:…` runs it: in the variables
 * given, which the environment file adds to, on the files of the package but
 * those the test names.
 */
export const runDatabaseCommand = async (
  argv: readonly string[],
  env: Record<string, string | undefined>,
  paths: Partial<CommandPaths> = {},
): Promise<CommandRun> => {
  const written = { stdout: '', stderr: '' }
  const status = await runCommand(
    COMMANDS,
    argv,
    {
      env,
      stdout: {
        write: (text: string) => {
          written.stdout += text
        },
      },
      stderr: {
        write: (text: string) => {
          written.stderr += text
        },
      },
    },
    { ...PACKAGE_PATHS, ...paths },
  )
  return { status, ...written }
}
