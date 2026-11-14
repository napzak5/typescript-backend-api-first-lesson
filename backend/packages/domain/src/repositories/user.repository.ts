import type { Result } from '@beauty-salon-backend/utility'
import type { DbUser, UserAccount, UserId } from '../models/auth'
import type { DomainError } from '../shared'

/** When repeated failed logins lock an account. */
export type LockRule = {
  /** The failure that reaches this count locks the account. */
  threshold: number
  /** Until when the account is locked then. */
  lockedUntil: string
}

export type SuccessfulLogin = {
  at: string
  ipAddress: string | null
  /** The password hashed with the current parameters; null keeps the stored hash. */
  passwordHash: string | null
}

/** Persistence of users. Deleted users are invisible to every method. */
export interface IUserRepository {
  /** `email` is matched as it is stored, in lower case. */
  findByEmail(email: string): Promise<Result<UserAccount | null, DomainError>>

  findById(id: UserId): Promise<Result<DbUser | null, DomainError>>

  /**
   * Counts one failed login and locks the account when the count reaches the
   * threshold, in a single statement, so that parallel attempts are all
   * counted.
   */
  recordFailedLogin(
    id: string,
    lockRule: LockRule,
  ): Promise<Result<null, DomainError>>

  /**
   * Clears the failure count and a lock, and notes when and from where the
   * user signed in. Resolves to null when the user no longer exists.
   */
  recordSuccessfulLogin(
    id: string,
    login: SuccessfulLogin,
  ): Promise<Result<DbUser | null, DomainError>>
}
