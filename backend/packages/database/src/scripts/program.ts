import { spawn } from 'node:child_process'

/** What a program wrote. */
export type ProgramOutput = { stdout: string; stderr: string }

export type ProgramOptions = {
  /** The folder it runs in */
  cwd: string
  /** The variables of its environment */
  env: Record<string, string | undefined>
  /** What it reads on its standard input */
  input: string
}

/**
 * Runs a program to its end: what it wrote. Rejects when it cannot be
 * started, or ends with a status other than 0, with what it wrote to its
 * standard error.
 */
export const runProgram = (
  command: string,
  args: readonly string[],
  { cwd, env, input }: ProgramOptions,
): Promise<ProgramOutput> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env })
    const output: ProgramOutput = { stdout: '', stderr: '' }
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      output.stdout += chunk
    })
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      output.stderr += chunk
    })
    // A program that cannot be started fails, and so does writing to it
    child.on('error', reject)
    child.stdin.on('error', reject)
    child.on('close', (status) => {
      if (status === 0) {
        resolve(output)
        return
      }
      reject(
        new Error(
          `${[command, ...args].join(' ')} ended with ${status}: ${output.stderr}`,
        ),
      )
    })
    child.stdin.end(input)
  })
