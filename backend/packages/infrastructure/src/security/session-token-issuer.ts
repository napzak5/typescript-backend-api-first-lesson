import { hash, randomBytes } from 'node:crypto'
import type {
  ISessionTokenIssuer,
  IssuedToken,
} from '@beauty-salon-backend/domain'

/** 256 bits from the system's CSPRNG; a session ID needs at least 64 bits of entropy. */
const TOKEN_BYTES = 32

/**
 * Opaque session tokens: random bytes in base64url, which is within the
 * characters a bearer token may have. A token is its own secret, long and
 * random, so a plain SHA-256 is enough to store it; the slowness of a
 * password hash would add nothing.
 */
export class SessionTokenIssuer implements ISessionTokenIssuer {
  issue(): IssuedToken {
    const token = randomBytes(TOKEN_BYTES).toString('base64url')
    return { token, hash: this.hashOf(token) }
  }

  hashOf(token: string): string {
    return hash('sha256', token)
  }
}
