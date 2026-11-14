import type { Result } from '@beauty-salon-backend/utility'
import type { DomainError } from '../shared'

export type PasswordVerification =
  /** `needsRehash`: the stored hash was made with weaker parameters than the current ones. */
  { type: 'match'; needsRehash: boolean } | { type: 'mismatch' }

/** One-way hashing of passwords; the hash carries its salt and parameters. */
export interface IPasswordHasher {
  hash(password: string): Promise<Result<string, DomainError>>

  /** A stored value that is not a hash this hasher made never matches. */
  verify(
    password: string,
    passwordHash: string,
  ): Promise<Result<PasswordVerification, DomainError>>
}
