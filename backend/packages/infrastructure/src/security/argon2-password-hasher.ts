import { argon2, randomBytes, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import {
  type DomainError,
  DomainErrors,
  type IPasswordHasher,
  type PasswordVerification,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'

const deriveKey = promisify(argon2)

/** Cost of one hash, in the units of the PHC string: `m` in KiB, `t`, `p`. */
type Cost = {
  memory: number
  passes: number
  parallelism: number
}

/**
 * The minimum configuration the OWASP Password Storage Cheat Sheet gives for
 * Argon2id: 19 MiB of memory, 2 iterations, 1 degree of parallelism.
 */
const CURRENT_COST: Cost = { memory: 19_456, passes: 2, parallelism: 1 }

const SALT_BYTES = 16
const TAG_BYTES = 32

/** `$argon2id$v=19$m=<KiB>,t=<passes>,p=<lanes>$<salt>$<tag>`, base64 without padding. */
const PHC_STRING =
  /^\$argon2id\$v=19\$m=(\d{1,10}),t=(\d{1,10}),p=(\d{1,3})\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/

const encode = (bytes: Buffer): string =>
  bytes.toString('base64').replace(/=+$/, '')

const toPhcString = (cost: Cost, salt: Buffer, tag: Buffer): string =>
  `$argon2id$v=19$m=${cost.memory},t=${cost.passes},p=${cost.parallelism}$${encode(salt)}$${encode(tag)}`

type StoredHash = {
  cost: Cost
  salt: Buffer
  tag: Buffer
}

const parsePhcString = (passwordHash: string): StoredHash | null => {
  const [, memory, passes, parallelism, salt, tag] =
    PHC_STRING.exec(passwordHash) ?? []

  return memory === undefined ||
    passes === undefined ||
    parallelism === undefined ||
    salt === undefined ||
    tag === undefined
    ? null
    : {
        cost: {
          memory: Number(memory),
          passes: Number(passes),
          parallelism: Number(parallelism),
        },
        salt: Buffer.from(salt, 'base64'),
        tag: Buffer.from(tag, 'base64'),
      }
}

/**
 * The limits `crypto.argon2` sets on its input. A stored value outside them
 * is no hash Argon2id could have made, so it matches no password; without
 * this check the failed derivation would surface as a server error, and tell
 * a caller that the account exists.
 */
const isDerivable = ({ cost, salt, tag }: StoredHash): boolean =>
  cost.parallelism >= 1 &&
  cost.parallelism <= 2 ** 24 - 1 &&
  cost.passes >= 1 &&
  cost.passes <= 2 ** 32 - 1 &&
  cost.memory >= 8 * cost.parallelism &&
  cost.memory <= 2 ** 32 - 1 &&
  salt.length >= 8 &&
  tag.length >= 4

const isCurrent = ({ cost, salt, tag }: StoredHash): boolean =>
  cost.memory === CURRENT_COST.memory &&
  cost.passes === CURRENT_COST.passes &&
  cost.parallelism === CURRENT_COST.parallelism &&
  salt.length === SALT_BYTES &&
  tag.length === TAG_BYTES

const derive = async (
  password: string,
  cost: Cost,
  salt: Buffer,
  tagLength: number,
): Promise<Result<Buffer, DomainError>> =>
  Result.mapError(
    await Result.fromPromise(
      deriveKey('argon2id', {
        message: password,
        nonce: salt,
        tagLength,
        ...cost,
      }),
    ),
    // Only the kind of failure: the message of a crypto error names no input,
    // and nothing else about the password may reach a log.
    (error) => DomainErrors.database('Password hashing failed', error.message),
  )

/**
 * Argon2id from Node's own `node:crypto`. A hash carries its salt and cost,
 * so hashes made with an older cost keep verifying and are reported as
 * needing a rehash.
 */
export class Argon2PasswordHasher implements IPasswordHasher {
  async hash(password: string): Promise<Result<string, DomainError>> {
    const salt = randomBytes(SALT_BYTES)

    return Result.map(
      await derive(password, CURRENT_COST, salt, TAG_BYTES),
      (tag) => toPhcString(CURRENT_COST, salt, tag),
    )
  }

  async verify(
    password: string,
    passwordHash: string,
  ): Promise<Result<PasswordVerification, DomainError>> {
    const stored = parsePhcString(passwordHash)
    if (stored === null || !isDerivable(stored)) {
      return Result.success({ type: 'mismatch' })
    }

    return Result.map(
      await derive(password, stored.cost, stored.salt, stored.tag.length),
      (tag) =>
        timingSafeEqual(tag, stored.tag)
          ? { type: 'match', needsRehash: !isCurrent(stored) }
          : { type: 'mismatch' },
    )
  }
}
