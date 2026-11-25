import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'
import type {
  IssuedTwoFactorSecret,
  ITwoFactorAuthenticator,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'

/**
 * The parameters of RFC 6238 that every authenticator app assumes:
 * HMAC-SHA-1, six digits, steps of 30 seconds counted from the Unix epoch.
 */
const STEP_SECONDS = 30
const DIGITS = 6

/** 160 bits, the length RFC 4226 recommends for the shared secret. */
const SECRET_BYTES = 20

/**
 * The steps a code may belong to, nearest first: the current one, and one
 * either side for a clock that is off or a code typed at the last moment
 * (RFC 6238, 5.2).
 */
const STEP_OFFSETS = [0, -1, 1]

const BACKUP_CODE_COUNT = 10
/** 80 bits: 16 characters of Base32. */
const BACKUP_CODE_BYTES = 10

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** The pieces of a text that a global pattern matches, in their order; none of an empty text. */
const piecesOf = (text: string, pattern: RegExp): string[] =>
  [...text.matchAll(pattern)].map(([piece]) => piece)

/** Base32 of RFC 4648 without padding, which is how authenticator apps take a secret. */
const toBase32 = (bytes: Buffer): string =>
  piecesOf(
    [...bytes].map((byte) => byte.toString(2).padStart(8, '0')).join(''),
    /.{1,5}/g,
  )
    .map((bits) =>
      BASE32_ALPHABET.charAt(Number.parseInt(bits.padEnd(5, '0'), 2)),
    )
    .join('')

/** `ABCD-EFGH-IJKL-MNOP`: groups that can be read and typed. */
const inGroups = (code: string): string => piecesOf(code, /.{1,4}/g).join('-')

/** HOTP of RFC 4226, 5.3, with the time step as its counter. */
const oneTimePassword = (secret: Buffer, step: number): string => {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const mac = createHmac('sha1', secret).update(counter).digest()
  const offset = mac.readUInt8(mac.length - 1) & 0x0f
  const truncated = mac.readUInt32BE(offset) & 0x7fff_ffff

  return String(truncated % 10 ** DIGITS).padStart(DIGITS, '0')
}

const SCHEME = 'aes-256-gcm'
const IV_BYTES = 12
/** The full tag of GCM; a shorter one is not taken for one. */
const TAG_BYTES = 16
/** `aes-256-gcm$<iv>$<ciphertext>$<tag>`, each part in base64url. */
const SEALED =
  /^aes-256-gcm\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/

/**
 * The bytes of one part of a stored value; null unless the part is written
 * the one way `seal` writes those bytes. Node's decoder also reads a part
 * with a character too many or with bits beyond its last byte, so a stored
 * value could be changed without changing what it opens to.
 */
const partBytes = (part: string): Buffer | null => {
  const bytes = Buffer.from(part, 'base64url')

  return bytes.toString('base64url') === part ? bytes : null
}

/**
 * Time-based one-time passwords from Node's own `node:crypto`. A secret is
 * stored encrypted (AES-256-GCM) under a key derived from configuration, so
 * that reading the database alone does not yield a working second factor
 * (RFC 6238, 5.1). A stored value that was encrypted under another key, or
 * was not made here at all, matches no code.
 */
export class TotpAuthenticator implements ITwoFactorAuthenticator {
  private readonly key: Buffer

  /** `encryptionKey`: a long random string that only the server's configuration holds. */
  constructor(encryptionKey: string) {
    this.key = Buffer.from(
      hkdfSync(
        'sha256',
        encryptionKey,
        Buffer.alloc(0),
        'beauty-salon:two-factor-secret',
        32,
      ),
    )
  }

  issueSecret(): IssuedTwoFactorSecret {
    const secret = randomBytes(SECRET_BYTES)

    return { secret: toBase32(secret), sealed: this.seal(secret) }
  }

  issueBackupCodes(): string[] {
    return Array.from({ length: BACKUP_CODE_COUNT }, () =>
      inGroups(toBase32(randomBytes(BACKUP_CODE_BYTES))),
    )
  }

  matchingStep(sealed: string, code: string, now: Date): number | null {
    const secret = this.open(sealed)
    if (secret === null) {
      return null
    }
    const typed = Buffer.from(code, 'utf8')
    const currentStep = Math.floor(now.getTime() / 1000 / STEP_SECONDS)

    return (
      STEP_OFFSETS.map((offset) => currentStep + offset)
        .filter((step) => step >= 0)
        .find((step) => {
          const expected = Buffer.from(oneTimePassword(secret, step), 'utf8')
          return (
            typed.length === expected.length && timingSafeEqual(typed, expected)
          )
        }) ?? null
    )
  }

  private seal(secret: Buffer): string {
    const iv = randomBytes(IV_BYTES)
    const cipher = createCipheriv(SCHEME, this.key, iv, {
      authTagLength: TAG_BYTES,
    })
    const ciphertext = Buffer.concat([cipher.update(secret), cipher.final()])

    return [
      SCHEME,
      iv.toString('base64url'),
      ciphertext.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
    ].join('$')
  }

  /** The secret behind a stored value; null when this key did not seal it. */
  private open(sealed: string): Buffer | null {
    const [iv = null, ciphertext = null, tag = null] = (
      SEALED.exec(sealed) ?? []
    )
      .slice(1)
      .map(partBytes)
    if (iv === null || ciphertext === null || tag === null) {
      return null
    }

    const opened = Result.fromThrowable(() => {
      const decipher = createDecipheriv(SCHEME, this.key, iv, {
        authTagLength: TAG_BYTES,
      })
      decipher.setAuthTag(tag)

      return Buffer.concat([decipher.update(ciphertext), decipher.final()])
    })

    return opened.type === 'success' ? opened.data : null
  }
}
