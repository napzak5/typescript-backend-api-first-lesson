import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { TotpAuthenticator } from '../totp-authenticator'

const KEY = 'key-of-the-authenticator-unit-tests-only'
const OTHER_KEY = 'another-key-that-sealed-none-of-the-secrets'

/** The secret of the RFC 6238 test vectors for SHA-1: 20 ASCII bytes. */
const RFC_SECRET = Buffer.from('12345678901234567890', 'ascii')

/** RFC 6238, Appendix B, SHA-1: the time, its step, and the last six of the eight digits. */
const rfcVectors: [number, number, string][] = [
  [59, 1, '287082'],
  [1_111_111_109, 37_037_036, '081804'],
  [1_111_111_111, 37_037_037, '050471'],
  [1_234_567_890, 41_152_263, '005924'],
  [2_000_000_000, 66_666_666, '279037'],
  [20_000_000_000, 666_666_666, '353130'],
]

const STEP_MS = 30_000

/** A step in the middle of November 2026, and an instant in its middle. */
const STEP = 59_821_560
const MID_STEP = new Date(STEP * STEP_MS + 15_000)

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

const SECRET = /^[A-Z2-7]{32}$/
const BACKUP_CODE = /^[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}$/
/** A 12-byte IV, 20 bytes of ciphertext and a 16-byte tag, in base64url without padding. */
const SEALED =
  /^aes-256-gcm\$[A-Za-z0-9_-]{16}\$[A-Za-z0-9_-]{27}\$[A-Za-z0-9_-]{22}$/

/**
 * The reference these tests compare with: HOTP of RFC 4226, 5.3, over the
 * time step as an 8-byte counter, with HMAC-SHA-1 and six digits. Written
 * for the tests; nothing of the authenticator is used.
 */
const totp = (secret: Buffer, step: number): string => {
  const counter = Buffer.alloc(8)
  counter.writeUInt32BE(Math.floor(step / 2 ** 32), 0)
  counter.writeUInt32BE(step % 2 ** 32, 4)
  const mac = createHmac('sha1', secret).update(counter).digest()
  const offset = mac.readUInt8(19) % 16
  const binary = mac.readUInt32BE(offset) % 2 ** 31

  return String(binary % 1_000_000).padStart(6, '0')
}

/** The bytes that Base32 of RFC 4648 without padding stands for. */
const fromBase32 = (text: string): Buffer => {
  const bits = [...text]
    .map((character) => {
      const value = BASE32_ALPHABET.indexOf(character)
      if (value < 0) {
        throw new Error(`Not a Base32 character: ${character}`)
      }
      return value.toString(2).padStart(5, '0')
    })
    .join('')
  const bytes = bits.match(/[01]{8}/g) ?? []

  return Buffer.from(bytes.map((byte) => Number.parseInt(byte, 2)))
}

/** The key the stored form is encrypted under: HKDF-SHA-256 of the configured string. */
const derivedKey = (encryptionKey: string): Buffer =>
  Buffer.from(
    hkdfSync(
      'sha256',
      Buffer.from(encryptionKey, 'utf8'),
      Buffer.alloc(0),
      Buffer.from('beauty-salon:two-factor-secret', 'utf8'),
      32,
    ),
  )

type SealedParts = { iv: Buffer; ciphertext: Buffer; tag: Buffer }

/** A secret encrypted as the documented stored form asks: AES-256-GCM, 12-byte IV, 16-byte tag. */
const sealedParts = (
  secret: Buffer,
  encryptionKey: string,
  iv: Buffer = randomBytes(12),
): SealedParts => {
  const cipher = createCipheriv('aes-256-gcm', derivedKey(encryptionKey), iv, {
    authTagLength: 16,
  })
  const ciphertext = Buffer.concat([cipher.update(secret), cipher.final()])

  return { iv, ciphertext, tag: cipher.getAuthTag() }
}

/** `aes-256-gcm$<iv>$<ciphertext>$<tag>`, the parts in base64url without padding. */
const stored = ({ iv, ciphertext, tag }: SealedParts): string =>
  [
    'aes-256-gcm',
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    tag.toString('base64url'),
  ].join('$')

const seal = (secret: Buffer, encryptionKey: string = KEY): string =>
  stored(sealedParts(secret, encryptionKey))

/** The parts of a stored value, decoded. */
const partsOf = (sealed: string): SealedParts => {
  const [, iv = '', ciphertext = '', tag = ''] = sealed.split('$')

  return {
    iv: Buffer.from(iv, 'base64url'),
    ciphertext: Buffer.from(ciphertext, 'base64url'),
    tag: Buffer.from(tag, 'base64url'),
  }
}

/** What a stored value decrypts to under the key derived from `encryptionKey`. */
const open = (sealed: string, encryptionKey: string): Buffer => {
  const { iv, ciphertext, tag } = partsOf(sealed)
  const decipher = createDecipheriv(
    'aes-256-gcm',
    derivedKey(encryptionKey),
    iv,
    { authTagLength: 16 },
  )
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

/** The same bytes with one bit changed. */
const withBitFlipped = (bytes: Buffer, index: number): Buffer => {
  const changed = Buffer.from(bytes)
  changed.writeUInt8(changed.readUInt8(index) ^ 0x01, index)
  return changed
}

describe('the reference implementation of these tests', () => {
  it.each(rfcVectors)(
    'gives for Unix time %i, step %i, the code %s of RFC 6238',
    (time, step, code) => {
      expect(Math.floor(time / 30)).toBe(step)
      expect(totp(RFC_SECRET, step)).toBe(code)
    },
  )

  it('decodes the Base32 example of RFC 4648', () => {
    expect(fromBase32('MZXW6YTBOI').toString('ascii')).toBe('foobar')
  })
})

describe('TotpAuthenticator.matchingStep', () => {
  const authenticator = new TotpAuthenticator(KEY)
  const rfcSealed = seal(RFC_SECRET)

  /** The codes of the RFC secret around `STEP`, none of which equals another. */
  const codeAt = (offset: number): string => totp(RFC_SECRET, STEP + offset)

  it.each(rfcVectors)(
    'matches at Unix time %i the step %i for the code %s of RFC 6238, with the secret in the documented stored form',
    (time, step, code) => {
      const matched = authenticator.matchingStep(
        rfcSealed,
        code,
        new Date(time * 1000),
      )

      expect(matched).toBe(step)
    },
  )

  it('reports the step before for its code: at 1111111111 the code of 1111111109', () => {
    const matched = authenticator.matchingStep(
      rfcSealed,
      '081804',
      new Date(1_111_111_111_000),
    )

    expect(matched).toBe(37_037_036)
  })

  it('reports the step after for its code: at 1111111109 the code of 1111111111', () => {
    const matched = authenticator.matchingStep(
      rfcSealed,
      '050471',
      new Date(1_111_111_109_000),
    )

    expect(matched).toBe(37_037_037)
  })

  it('has five different codes around the step the window is tested at', () => {
    const codes = [-2, -1, 0, 1, 2].map(codeAt)

    expect(new Set(codes).size).toBe(5)
  })

  it.each([
    ['the current step', 0],
    ['the step before', -1],
    ['the step after', 1],
  ])('accepts the code of %s and reports that step', (_case, offset) => {
    const matched = authenticator.matchingStep(
      rfcSealed,
      codeAt(offset),
      MID_STEP,
    )

    expect(matched).toBe(STEP + offset)
  })

  it.each([
    ['two steps before', -2],
    ['two steps after', 2],
    ['three steps before', -3],
    ['three steps after', 3],
    ['an hour before', -120],
    ['an hour after', 120],
  ])('refuses the code of %s', (_case, offset) => {
    const matched = authenticator.matchingStep(
      rfcSealed,
      codeAt(offset),
      MID_STEP,
    )

    expect(matched).toBeNull()
  })

  it.each([
    ['in its first millisecond', STEP * STEP_MS],
    ['in its last millisecond', STEP * STEP_MS + STEP_MS - 1],
  ])(
    'takes a step to last 30 seconds: %s the window is the same',
    (_case, time) => {
      const now = new Date(time)

      const matched = [-2, -1, 0, 1, 2].map((offset) =>
        authenticator.matchingStep(rfcSealed, codeAt(offset), now),
      )

      expect(matched).toEqual([null, STEP - 1, STEP, STEP + 1, null])
    },
  )

  it('moves the window with the step: a millisecond before a step begins, its successor is out of reach', () => {
    const now = new Date(STEP * STEP_MS - 1)

    const matched = [-2, -1, 0, 1].map((offset) =>
      authenticator.matchingStep(rfcSealed, codeAt(offset), now),
    )

    expect(matched).toEqual([STEP - 2, STEP - 1, STEP, null])
  })

  it('accepts at the epoch the codes of steps 0 and 1, and has no step before them', () => {
    const epoch = new Date(0)
    // What a counter of -1 would be as an unsigned 64-bit number.
    const wrapped = createHmac('sha1', RFC_SECRET)
      .update(Buffer.alloc(8, 0xff))
      .digest()
    const codeOfWrappedCounter = String(
      (wrapped.readUInt32BE(wrapped.readUInt8(19) % 16) % 2 ** 31) % 1_000_000,
    ).padStart(6, '0')

    const matched = [
      totp(RFC_SECRET, 0),
      totp(RFC_SECRET, 1),
      totp(RFC_SECRET, 2),
      codeOfWrappedCounter,
    ].map((code) => authenticator.matchingStep(rfcSealed, code, epoch))

    expect(matched).toEqual([0, 1, null, null])
  })

  it('answers every six digits at the epoch without throwing and with no negative step', () => {
    const epoch = new Date(0)
    const codes = ['000000', '999999', '287082', totp(RFC_SECRET, 0)]

    const matched = codes.map((code) =>
      authenticator.matchingStep(rfcSealed, code, epoch),
    )

    for (const step of matched) {
      expect(step === null || step >= 0).toBe(true)
    }
    expect(matched.at(-1)).toBe(0)
  })

  it.each([
    ['an empty code', ''],
    ['five digits of the code', '28708'],
    ['the code with a digit more', '2870820'],
    ['the eight digits the RFC prints', '94287082'],
    ['the code followed by a space', '287082 '],
    ['the code after a space', ' 287082'],
    ['the code with a space in the middle', '287 082'],
    ['the code followed by a line break', '287082\n'],
    ['the code in full-width digits', '２８７０８２'],
    ['two full-width digits, six bytes of UTF-8', '２８'],
    ['the code with a letter for its last digit', '28708B'],
    ['six letters', 'abcdef'],
    ['a decimal number', '2870.2'],
    ['a negative number', '-87082'],
    ['the secret itself', '12345678901234567890'],
  ])('matches no step for %s', (_case, code) => {
    const matched = authenticator.matchingStep(
      rfcSealed,
      code,
      new Date(59_000),
    )

    expect(matched).toBeNull()
  })

  it('matches the code whatever random IV the secret was sealed with', () => {
    const sealedValues = Array.from({ length: 20 }, () => seal(RFC_SECRET))

    const matched = sealedValues.map((sealed) =>
      authenticator.matchingStep(sealed, '287082', new Date(59_000)),
    )

    expect(new Set(sealedValues).size).toBe(20)
    expect(matched).toEqual(Array.from({ length: 20 }, () => 1))
  })

  it('derives its key from the UTF-8 bytes of the configured string', () => {
    const key = '鍵は設定にだけ置く・two-factor・0123456789abcdef'
    const sealed = seal(RFC_SECRET, key)

    const matched = new TotpAuthenticator(key).matchingStep(
      sealed,
      '287082',
      new Date(59_000),
    )

    expect(matched).toBe(1)
  })

  it.each([
    ['the right code', '287082'],
    ['the code of the step before', totp(RFC_SECRET, 0)],
    ['the code of the step after', totp(RFC_SECRET, 2)],
  ])(
    'matches no step for %s when the secret was sealed under another key',
    (_case, code) => {
      const sealedElsewhere = seal(RFC_SECRET, OTHER_KEY)

      const matched = authenticator.matchingStep(
        sealedElsewhere,
        code,
        new Date(59_000),
      )

      expect(matched).toBeNull()
      // The same value does match under the key that sealed it.
      expect(
        new TotpAuthenticator(OTHER_KEY).matchingStep(
          sealedElsewhere,
          code,
          new Date(59_000),
        ),
      ).not.toBeNull()
    },
  )

  it('matches no step under a key that differs in one character', () => {
    const sealed = seal(RFC_SECRET, KEY)

    const matched = new TotpAuthenticator(`${KEY.slice(0, -1)}Y`).matchingStep(
      sealed,
      '287082',
      new Date(59_000),
    )

    expect(matched).toBeNull()
  })

  const alterations: [string, (parts: SealedParts) => SealedParts][] = [
    [
      'the first bit of the IV changed',
      (parts) => ({ ...parts, iv: withBitFlipped(parts.iv, 0) }),
    ],
    [
      'the last bit of the IV changed',
      (parts) => ({ ...parts, iv: withBitFlipped(parts.iv, 11) }),
    ],
    [
      'the IV of another stored value',
      (parts) => ({ ...parts, iv: sealedParts(RFC_SECRET, KEY).iv }),
    ],
    [
      'an IV that lacks a byte',
      (parts) => ({ ...parts, iv: parts.iv.subarray(0, 11) }),
    ],
    [
      'the first bit of the ciphertext changed',
      (parts) => ({
        ...parts,
        ciphertext: withBitFlipped(parts.ciphertext, 0),
      }),
    ],
    [
      'the last bit of the ciphertext changed',
      (parts) => ({
        ...parts,
        ciphertext: withBitFlipped(parts.ciphertext, 19),
      }),
    ],
    [
      'a ciphertext that lacks a byte',
      (parts) => ({ ...parts, ciphertext: parts.ciphertext.subarray(0, 19) }),
    ],
    [
      'a ciphertext with a byte more',
      (parts) => ({
        ...parts,
        ciphertext: Buffer.concat([parts.ciphertext, Buffer.from([0])]),
      }),
    ],
    [
      'the ciphertext of another secret',
      (parts) => ({
        ...parts,
        ciphertext: sealedParts(Buffer.alloc(20, 7), KEY, parts.iv).ciphertext,
      }),
    ],
    [
      'the first bit of the tag changed',
      (parts) => ({ ...parts, tag: withBitFlipped(parts.tag, 0) }),
    ],
    [
      'the last bit of the tag changed',
      (parts) => ({ ...parts, tag: withBitFlipped(parts.tag, 15) }),
    ],
    [
      'a tag with a byte more',
      (parts) => ({
        ...parts,
        tag: Buffer.concat([parts.tag, Buffer.from([0])]),
      }),
    ],
    [
      'the IV and the tag swapped',
      (parts) => ({ ...parts, iv: parts.tag, tag: parts.iv }),
    ],
  ]

  it.each(alterations)(
    'matches no step, and does not throw, for a stored value with %s',
    (_case, alter) => {
      const altered = stored(alter(sealedParts(RFC_SECRET, KEY)))

      const matched = authenticator.matchingStep(
        altered,
        '287082',
        new Date(59_000),
      )

      expect(matched).toBeNull()
    },
  )

  it.each([15, 14, 13, 12, 8, 4, 1])(
    'matches no step, and does not throw, when the tag is shortened to its first %i bytes',
    (length) => {
      const parts = sealedParts(RFC_SECRET, KEY)
      const shortened = stored({ ...parts, tag: parts.tag.subarray(0, length) })

      const matched = authenticator.matchingStep(
        shortened,
        '287082',
        new Date(59_000),
      )

      expect(matched).toBeNull()
    },
  )

  it.each([12, 8, 4])(
    'matches no step for a secret that was sealed with a tag of %i bytes',
    (authTagLength) => {
      const iv = randomBytes(12)
      const cipher = createCipheriv('aes-256-gcm', derivedKey(KEY), iv, {
        authTagLength,
      })
      const ciphertext = Buffer.concat([
        cipher.update(RFC_SECRET),
        cipher.final(),
      ])

      const matched = authenticator.matchingStep(
        stored({ iv, ciphertext, tag: cipher.getAuthTag() }),
        '287082',
        new Date(59_000),
      )

      expect(matched).toBeNull()
    },
  )

  /** A stored value whose IV is `-_v7-_v7-_v7-_v7` in base64url and `+/v7+/v7+/v7+/v7` in base64. */
  const special = sealedParts(RFC_SECRET, KEY, Buffer.alloc(12, 0xfb))
  const valid = partsOf(rfcSealed)
  const part = (bytes: Buffer): string => bytes.toString('base64url')

  it('matches the code for the stored values the next rows are made from', () => {
    expect(stored(special)).toContain('$-_v7-_v7-_v7-_v7$')
    expect(
      [stored(special), stored(valid)].map((sealed) =>
        authenticator.matchingStep(sealed, '287082', new Date(59_000)),
      ),
    ).toEqual([1, 1])
  })

  it.each([
    ['an empty string', ''],
    ['a word', 'garbage'],
    ['the secret in Base32', 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'],
    ['the secret in hex', RFC_SECRET.toString('hex')],
    ['the scheme alone', 'aes-256-gcm'],
    ['the scheme with empty parts', 'aes-256-gcm$$$'],
    [
      'a value without its tag',
      `aes-256-gcm$${part(valid.iv)}$${part(valid.ciphertext)}`,
    ],
    [
      'a value with an empty tag',
      `aes-256-gcm$${part(valid.iv)}$${part(valid.ciphertext)}$`,
    ],
    ['a value with a part more', `${rfcSealed}$${part(valid.tag)}`],
    ['a value without its scheme', rfcSealed.replace('aes-256-gcm$', '')],
    ['another scheme', rfcSealed.replace('aes-256-gcm', 'aes-128-gcm')],
    ['the scheme in capitals', rfcSealed.replace('aes-256-gcm', 'AES-256-GCM')],
    ['a line break after the value', `${rfcSealed}\n`],
    ['a space before the value', ` ${rfcSealed}`],
    ['parts separated by colons', rfcSealed.replaceAll('$', ':')],
    [
      'an IV in base64 instead of base64url',
      `aes-256-gcm$${special.iv.toString('base64')}$${part(special.ciphertext)}$${part(special.tag)}`,
    ],
    [
      'a ciphertext with base64 padding',
      `aes-256-gcm$${part(valid.iv)}$${part(valid.ciphertext)}=$${part(valid.tag)}`,
    ],
    [
      'a tag with base64 padding',
      `aes-256-gcm$${part(valid.iv)}$${part(valid.ciphertext)}$${part(valid.tag)}==`,
    ],
    ['a PHC string', '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHQ$dGFndGFn'],
  ])(
    'matches no step, and does not throw, for a stored value that is %s',
    (_case, sealed) => {
      const matched = authenticator.matchingStep(
        sealed,
        '287082',
        new Date(59_000),
      )

      expect(matched).toBeNull()
    },
  )

  const BASE64URL_ALPHABET =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

  /**
   * The same text with the lowest bit of its last character set. In the
   * base64url of 20 or of 16 bytes that bit belongs to no byte and is 0.
   */
  const withStrayBit = (encoded: string): string =>
    encoded.slice(0, -1) +
    BASE64URL_ALPHABET.charAt(BASE64URL_ALPHABET.indexOf(encoded.slice(-1)) + 1)

  it.each([
    [
      'IV has a character more than the 16 that 12 bytes take',
      `aes-256-gcm$${part(valid.iv)}A$${part(valid.ciphertext)}$${part(valid.tag)}`,
    ],
    [
      'ciphertext ends in a character with a bit beyond its 20 bytes',
      `aes-256-gcm$${part(valid.iv)}$${withStrayBit(part(valid.ciphertext))}$${part(valid.tag)}`,
    ],
    [
      'tag ends in a character with a bit beyond its 16 bytes',
      `aes-256-gcm$${part(valid.iv)}$${part(valid.ciphertext)}$${withStrayBit(part(valid.tag))}`,
    ],
  ])(
    'matches no step for a stored value that was altered so that its %s',
    (_case, altered) => {
      const matched = authenticator.matchingStep(
        altered,
        '287082',
        new Date(59_000),
      )

      expect(altered).not.toBe(rfcSealed)
      expect(matched).toBeNull()
    },
  )
})

describe('TotpAuthenticator.issueSecret', () => {
  const authenticator = new TotpAuthenticator(KEY)

  it('shows the secret as 32 Base32 characters without padding and stores it in the sealed form', () => {
    const { secret, sealed } = authenticator.issueSecret()

    expect(secret).toMatch(SECRET)
    expect(sealed).toMatch(SEALED)
    expect(fromBase32(secret)).toHaveLength(20)
  })

  it('seals the 20 raw bytes of the secret with AES-256-GCM under the key derived from the configured string', () => {
    const { secret, sealed } = authenticator.issueSecret()

    const opened = open(sealed, KEY)

    expect(opened).toHaveLength(20)
    expect(opened.equals(fromBase32(secret))).toBe(true)
    expect(() => open(sealed, OTHER_KEY)).toThrow()
  })

  it('keeps the secret out of what is stored', () => {
    const { secret, sealed } = authenticator.issueSecret()
    const raw = fromBase32(secret)

    expect(sealed).not.toContain(secret)
    expect(sealed).not.toContain(raw.toString('base64url'))
    expect(sealed).not.toContain(raw.toString('hex'))
    expect(partsOf(sealed).ciphertext.equals(raw)).toBe(false)
  })

  it('issues a secret whose codes, computed from the Base32 it shows, match at their steps', () => {
    const { secret, sealed } = authenticator.issueSecret()
    const key = fromBase32(secret)

    const matched = authenticator.matchingStep(
      sealed,
      totp(key, STEP),
      MID_STEP,
    )
    const atAnotherTime = authenticator.matchingStep(
      sealed,
      totp(key, 41_152_263),
      new Date(1_234_567_890_000),
    )

    expect(matched).toBe(STEP)
    expect(atAnotherTime).toBe(41_152_263)
  })

  it('issues a secret that another authenticator with the same key reads, and one with another key does not', () => {
    const { secret, sealed } = authenticator.issueSecret()
    const code = totp(fromBase32(secret), STEP)

    const sameKey = new TotpAuthenticator(KEY).matchingStep(
      sealed,
      code,
      MID_STEP,
    )
    const otherKey = new TotpAuthenticator(OTHER_KEY).matchingStep(
      sealed,
      code,
      MID_STEP,
    )

    expect(sameKey).toBe(STEP)
    expect(otherKey).toBeNull()
  })

  it('does not accept the code of one secret for another', () => {
    const first = authenticator.issueSecret()
    const second = authenticator.issueSecret()
    const codeOfFirst = totp(fromBase32(first.secret), STEP)
    // One time in a million two secrets share a code at a step.
    const codesOfSecond = [-1, 0, 1].map((offset) =>
      totp(fromBase32(second.secret), STEP + offset),
    )

    const matched = authenticator.matchingStep(
      second.sealed,
      codeOfFirst,
      MID_STEP,
    )

    expect(matched === null || codesOfSecond.includes(codeOfFirst)).toBe(true)
  })

  it('issues a different secret, sealed with a different IV, every time', () => {
    const issued = Array.from({ length: 500 }, () =>
      authenticator.issueSecret(),
    )

    const ivs = issued.map(({ sealed }) => partsOf(sealed).iv.toString('hex'))
    expect(new Set(issued.map(({ secret }) => secret)).size).toBe(500)
    expect(new Set(issued.map(({ sealed }) => sealed)).size).toBe(500)
    expect(new Set(ivs).size).toBe(500)
    expect(issued.every(({ secret }) => SECRET.test(secret))).toBe(true)
    expect(issued.every(({ sealed }) => SEALED.test(sealed))).toBe(true)
  })

  it('uses the whole Base32 alphabet, in every position alike', () => {
    const secrets = Array.from(
      { length: 1000 },
      () => authenticator.issueSecret().secret,
    )

    const used = new Set(secrets.join(''))
    const first = new Set(secrets.map((secret) => secret.charAt(0)))
    const last = new Set(secrets.map((secret) => secret.charAt(31)))
    expect([...used].sort().join('')).toBe([...BASE32_ALPHABET].sort().join(''))
    expect(first.size).toBe(32)
    expect(last.size).toBe(32)
  })
})

describe('TotpAuthenticator.issueBackupCodes', () => {
  const authenticator = new TotpAuthenticator(KEY)

  it('issues ten codes of 16 Base32 characters in groups of four', () => {
    const codes = authenticator.issueBackupCodes()

    expect(codes).toHaveLength(10)
    for (const code of codes) {
      expect(code).toMatch(BACKUP_CODE)
    }
  })

  it('issues ten different codes', () => {
    const codes = authenticator.issueBackupCodes()

    expect(new Set(codes).size).toBe(10)
  })

  it('issues different codes every time', () => {
    const sets = Array.from({ length: 100 }, () =>
      authenticator.issueBackupCodes(),
    )

    const codes = sets.flat()
    expect(codes).toHaveLength(1000)
    expect(new Set(codes).size).toBe(1000)
    expect(codes.every((code) => BACKUP_CODE.test(code))).toBe(true)
  })

  it('carries 80 bits in a code: the whole alphabet, in the first and the last character alike', () => {
    const codes = Array.from({ length: 100 }, () =>
      authenticator.issueBackupCodes(),
    )
      .flat()
      .map((code) => code.replaceAll('-', ''))

    const used = new Set(codes.join(''))
    const first = new Set(codes.map((code) => code.charAt(0)))
    const last = new Set(codes.map((code) => code.charAt(15)))
    expect(codes.every((code) => fromBase32(code).length === 10)).toBe(true)
    expect([...used].sort().join('')).toBe([...BASE32_ALPHABET].sort().join(''))
    expect(first.size).toBe(32)
    expect(last.size).toBe(32)
  })

  it('issues codes that have nothing to do with the encryption key or a secret', () => {
    const codes = new TotpAuthenticator(OTHER_KEY).issueBackupCodes()

    expect(codes).toHaveLength(10)
    expect(codes.every((code) => BACKUP_CODE.test(code))).toBe(true)
  })
})
