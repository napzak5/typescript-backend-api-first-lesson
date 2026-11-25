import { describe, expect, it } from 'vitest'
import { runProgram } from '../program'

/** Runs a script of Node.js in this folder, with what it reads. */
const runNode = (script: string, input = '') =>
  runProgram(process.execPath, ['--eval', script], {
    cwd: import.meta.dirname,
    env: { NOTE: 'from the environment' },
    input,
  })

describe('runProgram', () => {
  it('should give what the program wrote, having given it its input and its variables', async () => {
    // Act
    const output = await runNode(
      `process.stdin.setEncoding('utf8').on('data', (text) => process.stdout.write(text.toUpperCase()))
       process.stderr.write(process.env.NOTE)`,
      'what it reads',
    )

    // Assert
    expect(output).toEqual({
      stdout: 'WHAT IT READS',
      stderr: 'from the environment',
    })
  })

  it('should reject when the program ends with another status than 0, with what it wrote to its standard error', async () => {
    // Act
    const output = runNode(`process.stderr.write('it broke'); process.exit(3)`)

    // Assert
    await expect(output).rejects.toThrow(
      `${process.execPath} --eval process.stderr.write('it broke'); process.exit(3) ended with 3: it broke`,
    )
  })

  it('should reject when the program cannot be started', async () => {
    // Act
    const output = runProgram('no-such-program-of-the-test', [], {
      cwd: import.meta.dirname,
      env: {},
      input: 'what it would read',
    })

    // Assert
    await expect(output).rejects.toThrow(
      'spawn no-such-program-of-the-test ENOENT',
    )
  })
})
