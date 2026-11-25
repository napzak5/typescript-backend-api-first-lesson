import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  databaseUrlOf,
  loadEnvFile,
  loadEnvFileFrom,
  REPOSITORY_ROOT,
} from '../env-loader'

/** A directory of the test's own, with the environment files it is given. */
let directory = ''

const withFiles = (files: Record<string, string>): string => {
  for (const [name, text] of Object.entries(files)) {
    writeFileSync(join(directory, name), text)
  }
  return directory
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'env-loader-'))
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

describe('loadEnvFileFrom', () => {
  it('should read .env when it exists, and not the file of the environment', () => {
    // Arrange
    const variables = { NODE_ENV: 'test' }
    withFiles({ '.env': 'SOURCE=dot-env', '.env.test': 'SOURCE=dot-env-test' })

    // Act
    const loaded = loadEnvFileFrom(directory, variables)

    // Assert
    expect(loaded).toEqual({ environment: 'test', file: '.env' })
    expect(variables).toEqual({ NODE_ENV: 'test', SOURCE: 'dot-env' })
  })

  it('should read the file of the environment when there is no .env', () => {
    // Arrange
    const variables = { NODE_ENV: 'staging' }
    withFiles({ '.env.staging': 'SOURCE=staging', '.env.test': 'SOURCE=test' })

    // Act
    const loaded = loadEnvFileFrom(directory, variables)

    // Assert
    expect(loaded).toEqual({ environment: 'staging', file: '.env.staging' })
    expect(variables).toEqual({ NODE_ENV: 'staging', SOURCE: 'staging' })
  })

  it('should read no file and change no variable when neither file exists', () => {
    // Arrange
    const variables = { NODE_ENV: 'production' }
    withFiles({ '.env.staging': 'SOURCE=staging' })

    // Act
    const loaded = loadEnvFileFrom(directory, variables)

    // Assert
    expect(loaded).toEqual({ environment: 'production', file: null })
    expect(variables).toEqual({ NODE_ENV: 'production' })
  })

  it('should leave a variable that is already set as it is', () => {
    // Arrange
    const variables = { NODE_ENV: 'test', PORT: '4000' }
    withFiles({ '.env.test': 'PORT=3000\nHOST=127.0.0.1' })

    // Act
    loadEnvFileFrom(directory, variables)

    // Assert
    expect(variables).toEqual({
      NODE_ENV: 'test',
      PORT: '4000',
      HOST: '127.0.0.1',
    })
  })

  it.each([
    ['unset', {}],
    ['an environment it does not know', { NODE_ENV: 'qa' }],
  ])(
    'should take the environment for localhost when NODE_ENV is %s',
    (_, variables) => {
      // Arrange
      withFiles({ '.env.localhost': 'SOURCE=localhost' })

      // Act
      const loaded = loadEnvFileFrom(directory, variables)

      // Assert
      expect(loaded).toEqual({
        environment: 'localhost',
        file: '.env.localhost',
      })
      expect(variables).toMatchObject({ SOURCE: 'localhost' })
    },
  )
})

describe('loadEnvFile', () => {
  it('should read the environment file of the repository root', () => {
    // Arrange
    const variables: Record<string, string | undefined> = { NODE_ENV: 'test' }

    // Act
    const loaded = loadEnvFile(variables)

    // Assert
    expect(existsSync(join(REPOSITORY_ROOT, 'pnpm-workspace.yaml'))).toBe(true)
    expect(loaded.environment).toBe('test')
    expect(existsSync(join(REPOSITORY_ROOT, loaded.file ?? 'no file'))).toBe(
      true,
    )
    expect(variables['DATABASE_URL']).toEqual(expect.any(String))
  })
})

describe('databaseUrlOf', () => {
  it('should give DATABASE_URL when it is set', () => {
    // Arrange
    const variables = {
      DATABASE_URL: 'postgres://owner:secret@db.salon.example:6543/salons',
      POSTGRES_USER: 'someone-else',
    }

    // Act
    const url = databaseUrlOf(variables)

    // Assert
    expect(url).toBe('postgres://owner:secret@db.salon.example:6543/salons')
  })

  it('should put the URL together from its parts when DATABASE_URL is empty', () => {
    // Arrange
    const variables = {
      DATABASE_URL: '',
      POSTGRES_USER: 'owner',
      POSTGRES_PASSWORD: 'secret',
      DB_HOST: 'db.salon.example',
      POSTGRES_PORT: '6543',
      POSTGRES_DB: 'salons',
    }

    // Act
    const url = databaseUrlOf(variables)

    // Assert
    expect(url).toBe('postgres://owner:secret@db.salon.example:6543/salons')
  })

  it('should take the database of local development for every part that is not set', () => {
    // Arrange
    const variables = { NODE_ENV: 'development' }

    // Act
    const url = databaseUrlOf(variables)

    // Assert
    expect(url).toBe('postgres://postgres:postgres@localhost:5432/beauty_salon')
  })
})
