import { argon2Sync, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { Argon2PasswordHasher } from '../argon2-password-hasher'

const PASSWORD = 'correct horse battery staple'

/** `$argon2id$v=19$m=<KiB>,t=<passes>,p=<lanes>$<salt>$<tag>`, base64 without padding. */
const PHC_STRING =
  /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/

const unpadded = (bytes: Buffer): string =>
  bytes.toString('base64').replace(/=+$/, '')

type Parameters = {
  algorithm?: 'argon2id' | 'argon2i' | 'argon2d'
  memory: number
  passes: number
  parallelism: number
  saltBytes?: number
  tagLength?: number
}

/** A PHC string made directly with `node:crypto`, with the given parameters. */
const phcString = (
  password: string,
  {
    algorithm = 'argon2id',
    memory,
    passes,
    parallelism,
    saltBytes = 16,
    tagLength = 32,
  }: Parameters,
): string => {
  const salt = randomBytes(saltBytes)
  const tag = argon2Sync(algorithm, {
    message: password,
    nonce: salt,
    memory,
    passes,
    parallelism,
    tagLength,
  })
  return `$${algorithm}$v=19$m=${memory},t=${passes},p=${parallelism}$${unpadded(salt)}$${unpadded(tag)}`
}

const CURRENT = { memory: 19_456, passes: 2, parallelism: 1 }

const hashOf = async (password: string): Promise<string> => {
  const hashed = await new Argon2PasswordHasher().hash(password)
  if (hashed.type === 'error') {
    throw new Error(`Hashing failed: ${JSON.stringify(hashed.error)}`)
  }
  return hashed.data
}

describe('Argon2PasswordHasher.hash', () => {
  it('makes an Argon2id PHC string with m=19456, t=2, p=1, a 16-byte salt and a 32-byte tag', async () => {
    const hash = await hashOf(PASSWORD)

    const [, memory, passes, parallelism, salt, tag] =
      PHC_STRING.exec(hash) ?? []
    expect([memory, passes, parallelism]).toEqual(['19456', '2', '1'])
    expect(Buffer.from(salt ?? '', 'base64')).toHaveLength(16)
    expect(Buffer.from(tag ?? '', 'base64')).toHaveLength(32)
  })

  it('makes a tag that Argon2id gives for the password and the salt', async () => {
    const hash = await hashOf(PASSWORD)

    const [, , , , salt, tag] = PHC_STRING.exec(hash) ?? []
    const expected = argon2Sync('argon2id', {
      message: PASSWORD,
      nonce: Buffer.from(salt ?? '', 'base64'),
      ...CURRENT,
      tagLength: 32,
    })
    expect(tag).toBe(unpadded(expected))
  })

  it('uses a new salt for every hash', async () => {
    const first = await hashOf(PASSWORD)
    const second = await hashOf(PASSWORD)

    expect(first).not.toBe(second)
    expect(PHC_STRING.exec(first)?.[4]).not.toBe(PHC_STRING.exec(second)?.[4])
  })

  it('does not contain the password', async () => {
    const hash = await hashOf(PASSWORD)

    expect(hash).not.toContain(PASSWORD)
    expect(hash).not.toContain(Buffer.from(PASSWORD).toString('base64'))
  })
})

describe('Argon2PasswordHasher.verify', () => {
  const hasher = new Argon2PasswordHasher()

  it('matches the password of a hash it made, without asking for a rehash', async () => {
    const hash = await hashOf(PASSWORD)

    const result = await hasher.verify(PASSWORD, hash)

    expect(result).toEqual({
      type: 'success',
      data: { type: 'match', needsRehash: false },
    })
  })

  it.each([
    ['another password', 'correct horse battery stapler'],
    ['the password in another case', PASSWORD.toUpperCase()],
    ['an empty password', ''],
  ])('does not match %s', async (_case, password) => {
    const hash = await hashOf(PASSWORD)

    const result = await hasher.verify(password, hash)

    expect(result).toEqual({ type: 'success', data: { type: 'mismatch' } })
  })

  it.each<[string, Parameters]>([
    ['less memory', { ...CURRENT, memory: 4_096 }],
    ['fewer passes', { ...CURRENT, passes: 1 }],
    [
      'less memory and fewer passes',
      { memory: 8_192, passes: 1, parallelism: 1 },
    ],
    ['a shorter salt', { ...CURRENT, saltBytes: 8 }],
    ['a shorter tag', { ...CURRENT, tagLength: 16 }],
  ])(
    'matches a hash made with %s and asks for a rehash',
    async (_case, parameters) => {
      const hash = phcString(PASSWORD, parameters)

      const result = await hasher.verify(PASSWORD, hash)

      expect(result).toEqual({
        type: 'success',
        data: { type: 'match', needsRehash: true },
      })
    },
  )

  it('does not match a wrong password against a hash with weaker parameters', async () => {
    const hash = phcString(PASSWORD, { ...CURRENT, memory: 4_096 })

    const result = await hasher.verify('wrong password', hash)

    expect(result).toEqual({ type: 'success', data: { type: 'mismatch' } })
  })

  it('matches a hash that node:crypto made with the current parameters, without asking for a rehash', async () => {
    const hash = phcString(PASSWORD, CURRENT)

    const result = await hasher.verify(PASSWORD, hash)

    expect(result).toEqual({
      type: 'success',
      data: { type: 'match', needsRehash: false },
    })
  })

  it.each<[string, () => Promise<string> | string]>([
    [
      'a bcrypt hash',
      () => '$2b$10$K7L1OJ0TfmQjGt2RGk/f9eJgzgVpFZhXXvKqKvKqKvKqKvKqKvKqK',
    ],
    ['garbage', () => 'not a hash at all'],
    ['an empty string', () => ''],
    ['the password itself', () => PASSWORD],
    [
      'an Argon2i hash of the password',
      () => phcString(PASSWORD, { ...CURRENT, algorithm: 'argon2i' }),
    ],
    [
      'an Argon2d hash of the password',
      () => phcString(PASSWORD, { ...CURRENT, algorithm: 'argon2d' }),
    ],
    [
      'an Argon2id hash of another version',
      async () => (await hashOf(PASSWORD)).replace('$v=19$', '$v=16$'),
    ],
    [
      'an Argon2id hash with a changed tag',
      async () => {
        const hash = await hashOf(PASSWORD)
        const [, , , , , tag] = PHC_STRING.exec(hash) ?? []
        const changed = Buffer.from(tag ?? '', 'base64')
        changed[0] = (changed[0] ?? 0) ^ 0xff
        return hash.replace(/\$[^$]+$/, `$${unpadded(changed)}`)
      },
    ],
    [
      'an Argon2id hash without its tag',
      async () => (await hashOf(PASSWORD)).replace(/\$[^$]+$/, ''),
    ],
  ])('never matches %s', async (_case, storedValue) => {
    const result = await hasher.verify(PASSWORD, await storedValue())

    expect(result).toEqual({ type: 'success', data: { type: 'mismatch' } })
  })

  // Strings in the Argon2id PHC format whose parameters Argon2id does not
  // allow (memory below 8 KiB per lane, no pass, no lane, a salt under 8
  // bytes). No password can match them: they are garbage, like the values
  // above.
  it.each([
    ['memory of 1 KiB', 'm=1,t=2,p=1', 16],
    ['no pass', 'm=19456,t=0,p=1', 16],
    ['no lane', 'm=19456,t=2,p=0', 16],
    ['a salt of 4 bytes', 'm=19456,t=2,p=1', 4],
  ])(
    'never matches an Argon2id string with %s',
    async (_case, parameters, saltBytes) => {
      const stored = `$argon2id$v=19$${parameters}$${unpadded(randomBytes(saltBytes))}$${unpadded(randomBytes(32))}`

      const result = await hasher.verify(PASSWORD, stored)

      expect(result).toEqual({ type: 'success', data: { type: 'mismatch' } })
    },
  )
})
