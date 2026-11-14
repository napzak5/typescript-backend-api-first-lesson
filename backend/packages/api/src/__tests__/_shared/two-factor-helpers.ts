import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from 'node:crypto'
import type { users } from '@beauty-salon-backend/database'
import { passwordHashOf } from './auth-helpers'
import { TWO_FACTOR_ENCRYPTION_KEY } from './test-helpers'

/**
 * What the tests of two-factor authentication compute themselves: the codes
 * of an authenticator app (RFC 6238) and the form in which the server keeps
 * a secret. Nothing here calls the code under test.
 */

type NewUser = typeof users.$inferInsert

/** The alphabet of Base32 (RFC 4648). */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

const toBase32 = (bytes: Buffer): string => {
  const bits = [...bytes]
    .map((byte) => byte.toString(2).padStart(8, '0'))
    .join('')
  const groups = bits.match(/.{1,5}/g) ?? []

  return groups
    .map((group) => ALPHABET.charAt(Number.parseInt(group.padEnd(5, '0'), 2)))
    .join('')
}

const fromBase32 = (text: string): Buffer => {
  const bits = [...text]
    .map((character) => {
      const value = ALPHABET.indexOf(character)
      if (value < 0) {
        throw new Error(`${text} is not Base32`)
      }
      return value.toString(2).padStart(5, '0')
    })
    .join('')
  const bytes = bits.match(/.{8}/g) ?? []

  return Buffer.from(bytes.map((byte) => Number.parseInt(byte, 2)))
}

/** The 30-second step that an instant falls in: now, unless another is given. */
export const stepAt = (ms: number = Date.now()): number =>
  Math.floor(ms / 30_000)

/**
 * The code that an authenticator app shows for a Base32 `secret` during
 * `step`: HMAC-SHA-1 over the step as a 64-bit counter, truncated to six
 * digits (RFC 4226, section 5.3).
 */
export const totp = (secret: string, step: number): string => {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const mac = createHmac('sha1', fromBase32(secret)).update(counter).digest()
  const offset = (mac.at(-1) ?? 0) & 0x0f
  const binary = mac.readUInt32BE(offset) & 0x7fff_ffff

  return String(binary % 1_000_000).padStart(6, '0')
}

/** The key that secrets are encrypted under: HKDF-SHA-256 of the configured string. */
const keyFrom = (configured: string): Buffer =>
  Buffer.from(
    hkdfSync(
      'sha256',
      Buffer.from(configured, 'utf8'),
      Buffer.alloc(0),
      'beauty-salon:two-factor-secret',
      32,
    ),
  )

const BASE64URL = /^[A-Za-z0-9_-]+$/

/**
 * A Base32 secret as the server stores it:
 * `aes-256-gcm$<iv>$<ciphertext>$<tag>`, each part in base64url without
 * padding, encrypted under the key of the application under test unless
 * another one is given.
 */
export const sealSecret = (
  secret: string,
  configuredKey: string = TWO_FACTOR_ENCRYPTION_KEY,
): string => {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyFrom(configuredKey), iv)
  const ciphertext = Buffer.concat([
    cipher.update(fromBase32(secret)),
    cipher.final(),
  ])

  return [
    'aes-256-gcm',
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
  ].join('$')
}

/**
 * The Base32 secret in a stored value. Throws unless the value is in the
 * form above and was encrypted under the key of the application under test.
 */
export const openSecret = (stored: string | null): string => {
  const [scheme, iv, ciphertext, tag, ...rest] = (stored ?? '').split('$')
  if (
    scheme !== 'aes-256-gcm' ||
    iv === undefined ||
    ciphertext === undefined ||
    tag === undefined ||
    rest.length > 0 ||
    ![iv, ciphertext, tag].every((part) => BASE64URL.test(part))
  ) {
    throw new Error(`${stored} is not a secret in its stored form`)
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    keyFrom(TWO_FACTOR_ENCRYPTION_KEY),
    Buffer.from(iv, 'base64url'),
    { authTagLength: 16 },
  )
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))

  return toBase32(
    Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]),
  )
}

/** The secret of every user that `twoFactorUser` describes: 20 bytes in Base32. */
export const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'

/** The backup codes of those users, as they were shown to them. */
export const BACKUP_CODES: [string, string, string] = [
  'ABCD-EFGH-IJKL-MNOP',
  'QRST-UVWX-YZ23-4567',
  '2345-6723-4567-ABCD',
]

let hashesOfBackupCodes: Promise<string[]> | undefined

/**
 * What the API stores of `BACKUP_CODES`, in their order: a hash of each
 * code without its hyphens, made by the API's hasher once per file.
 */
export const backupCodeHashes = (): Promise<string[]> => {
  hashesOfBackupCodes ??= Promise.all(
    BACKUP_CODES.map((code) => passwordHashOf(code.replaceAll('-', ''))),
  )
  return hashesOfBackupCodes
}

/**
 * The columns of a user whose two-factor authentication is being set up
 * (`pending`) or on (`enabled`): `SECRET` as the server stores it, the
 * hashes of `BACKUP_CODES`, and no code accepted yet.
 */
export const twoFactorUser = async (
  twoFactorStatus: 'pending' | 'enabled',
  overrides: Partial<NewUser> = {},
): Promise<Partial<NewUser>> => ({
  twoFactorStatus,
  twoFactorSecret: sealSecret(SECRET),
  backupCodes: await backupCodeHashes(),
  twoFactorLastUsedStep: null,
  ...overrides,
})
