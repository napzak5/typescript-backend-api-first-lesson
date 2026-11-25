import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it } from 'vitest'
import {
  type Command,
  type CommandContext,
  dataOf,
  PACKAGE_PATHS,
  runCommand,
  shownUrl,
} from '../command'

/** A command that keeps the context it ran with, and ends with the status. */
const commandThatAnswers = (
  name: string,
  status: number,
): { command: Command; contexts: CommandContext[] } => {
  const contexts: CommandContext[] = []
  return {
    command: {
      name,
      help: `Usage: ${name}\n`,
      run: async (context) => {
        contexts.push(context)
        context.say(`${name} ran`)
        context.complain(`${name} complained`)
        return status
      },
    },
    contexts,
  }
}

/** Runs the commands with the arguments in the variables, and what they wrote. */
const runWith = async (
  commands: readonly Command[],
  argv: readonly string[],
  env: Record<string, string | undefined> = { NODE_ENV: 'test' },
) => {
  const written = { stdout: '', stderr: '' }
  const status = await runCommand(
    commands,
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
    PACKAGE_PATHS,
  )
  return { status, ...written }
}

describe('runCommand', () => {
  it('should run the command its first argument names, with the arguments after it, and end with its status', async () => {
    // Arrange
    const first = commandThatAnswers('first', 0)
    const second = commandThatAnswers('second', 3)

    // Act
    const run = await runWith(
      [first.command, second.command],
      ['second', 'a', '--b'],
    )

    // Assert
    expect(run).toEqual({
      status: 3,
      stdout: 'second ran\n',
      stderr: 'second complained\n',
    })
    expect(first.contexts).toEqual([])
    expect(second.contexts).toEqual([
      expect.objectContaining({ args: ['a', '--b'], paths: PACKAGE_PATHS }),
    ])
  })

  it('should run the command in its environment, with the variables of the environment file and the database URL of the variables', async () => {
    // Arrange
    const { command, contexts } = commandThatAnswers('first', 0)
    const env = {
      NODE_ENV: 'staging',
      DATABASE_URL: 'postgres://owner:secret@db.salon.example:6543/salons',
    }

    // Act
    await runWith([command], ['first'], env)

    // Assert
    expect(contexts).toEqual([
      expect.objectContaining({
        environment: 'staging',
        databaseUrl: 'postgres://owner:secret@db.salon.example:6543/salons',
        env: expect.objectContaining({ MAIL_FROM: expect.any(String) }),
      }),
    ])
  })

  it.each([['--help'], ['-h']])(
    'should write what the command does for %s, and run nothing',
    async (flag) => {
      // Arrange
      const { command, contexts } = commandThatAnswers('first', 0)

      // Act
      const run = await runWith([command], ['first', 'a', flag])

      // Assert
      expect(run).toEqual({ status: 0, stdout: 'Usage: first\n', stderr: '' })
      expect(contexts).toEqual([])
    },
  )

  it.each([
    [
      ['unknown', 'a'],
      '❌ No command "unknown a". The commands: first, second\n',
    ],
    [[], '❌ No command "". The commands: first, second\n'],
  ])('should refuse %j, naming the commands there are', async (argv, said) => {
    // Arrange
    const first = commandThatAnswers('first', 0)
    const second = commandThatAnswers('second', 0)

    // Act
    const run = await runWith([first.command, second.command], argv)

    // Assert
    expect(run).toEqual({ status: 1, stdout: '', stderr: said })
    expect([...first.contexts, ...second.contexts]).toEqual([])
  })

  it('should end with 1 when the command fails, and tell why', async () => {
    // Arrange
    const failing: Command = {
      name: 'failing',
      help: '',
      run: () => Promise.reject(new Error('the database went away')),
    }

    // Act
    const run = await runWith([failing], ['failing'])

    // Assert
    expect(run.status).toBe(1)
    expect(run.stdout).toBe('')
    expect(run.stderr).toMatch(
      /^❌ failing failed: Error: the database went away\n {4}at /,
    )
  })
})

describe('dataOf', () => {
  it('should give the data of a success', () => {
    // Act
    const data = dataOf(Result.success('the schema'))

    // Assert
    expect(data).toBe('the schema')
  })

  it('should fail with the error of an error, which ends the command', () => {
    // Act
    const read = () => dataOf(Result.error('no table "salons" in the output'))

    // Assert
    expect(read).toThrow(new Error('no table "salons" in the output'))
  })
})

describe('shownUrl', () => {
  it('should hide the password of the URL', () => {
    // Act
    const shown = shownUrl(
      'postgres://owner:secret@db.salon.example:6543/salons',
    )

    // Assert
    expect(shown).toBe('postgres://owner:***@db.salon.example:6543/salons')
  })

  it('should show a URL without a password as it is', () => {
    // Act
    const shown = shownUrl('postgres://db.salon.example:6543/salons')

    // Assert
    expect(shown).toBe('postgres://db.salon.example:6543/salons')
  })
})
