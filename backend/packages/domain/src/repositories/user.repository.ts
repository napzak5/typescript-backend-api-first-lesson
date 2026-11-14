import type { Result } from '@beauty-salon-backend/utility'
import type { DbUser, SessionId, UserAccount, UserId } from '../models/auth'
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

/** What is stored of a mailed token: its hash and until when it works. */
export type MailedToken = {
  tokenHash: string
  expiresAt: string
}

/** An account as a registration leaves it: a customer who has yet to confirm the address. */
export type Registration = {
  email: string
  passwordHash: string
  emailVerification: MailedToken
}

export type PasswordReset = {
  passwordHash: string
  at: string
}

export type PasswordChange = {
  passwordHash: string
  at: string
  /** The session that goes on; the user's other sessions end. */
  keepSessionId: SessionId
}

/** What is stored when a user starts to set up two-factor authentication. */
export type TwoFactorSetup = {
  /** The secret of the authenticator app, encrypted. */
  sealedSecret: string
  backupCodeHashes: string[]
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

  /**
   * Stores a new customer account that is unverified. Resolves to false
   * when a user already has the email, which a parallel registration can
   * bring about after the caller looked.
   */
  createUnverified(
    registration: Registration,
  ): Promise<Result<boolean, DomainError>>

  /**
   * Makes an account that is still unverified the one of a later
   * registration: its password and its verification token are replaced.
   * Resolves to false when the account is not unverified any more.
   */
  renewRegistration(
    id: string,
    registration: Omit<Registration, 'email'>,
  ): Promise<Result<boolean, DomainError>>

  /**
   * Gives a user whose address is not verified a new verification token,
   * which replaces the one before. Resolves to false when the address has
   * been verified meanwhile.
   */
  issueEmailVerification(
    id: string,
    token: MailedToken,
  ): Promise<Result<boolean, DomainError>>

  /**
   * Marks the address of the user who holds this token as verified, makes
   * an unverified account active and uses the token up, in a single
   * statement: of two parallel calls one gets the user. Resolves to null
   * when no user holds the token or it ended at or before `now`.
   */
  confirmEmail(
    tokenHash: string,
    now: string,
  ): Promise<Result<DbUser | null, DomainError>>

  /** Gives a user a new password reset token, which replaces the one before. */
  issuePasswordReset(
    id: string,
    token: MailedToken,
  ): Promise<Result<boolean, DomainError>>

  /** The user who holds this password reset token, unless it ended at or before `now`. */
  findByPasswordResetToken(
    tokenHash: string,
    now: string,
  ): Promise<Result<DbUser | null, DomainError>>

  /**
   * Sets the password of the user who holds this token and uses the token
   * up. The mailbox is thereby proven, so the address counts as verified
   * and an unverified account becomes active; the count of failed logins
   * and a lock are cleared; every session of the user ends. All of it
   * happens in one transaction. Resolves to null when no user holds the
   * token or it ended at or before `reset.at`.
   */
  resetPassword(
    tokenHash: string,
    reset: PasswordReset,
  ): Promise<Result<DbUser | null, DomainError>>

  /**
   * Sets a new password, clears the count of failed logins, drops a
   * password reset token that is still out and ends the sessions of the
   * user other than `keepSessionId`, in one transaction. Resolves to false
   * when the user no longer exists.
   */
  changePassword(
    id: UserId,
    change: PasswordChange,
  ): Promise<Result<boolean, DomainError>>

  /**
   * Stores a new secret and new backup codes and marks two-factor
   * authentication as being set up, which replaces a setup that was under
   * way. Resolves to false when it is already enabled.
   */
  startTwoFactorSetup(
    id: UserId,
    setup: TwoFactorSetup,
  ): Promise<Result<boolean, DomainError>>

  /**
   * Notes that the one-time password of this time step was accepted, in a
   * single statement that only succeeds for a step later than the last one:
   * a code works once, also when it is sent twice at the same moment.
   * Resolves to false when this step or a later one was accepted before,
   * or when the user does not hold `sealedSecret` any more.
   */
  useTwoFactorStep(
    id: string,
    sealedSecret: string,
    step: number,
  ): Promise<Result<boolean, DomainError>>

  /**
   * Uses a backup code up, in a single statement: of two parallel calls
   * one succeeds. Resolves to the number of backup codes that are left, or
   * to null when the user does not hold this one any more.
   */
  useBackupCode(
    id: string,
    backupCodeHash: string,
  ): Promise<Result<number | null, DomainError>>

  /**
   * Turns the setup of `sealedSecret` on. Resolves to false when no setup
   * is under way, or when the one under way has another secret by now.
   */
  enableTwoFactor(
    id: UserId,
    sealedSecret: string,
  ): Promise<Result<boolean, DomainError>>

  /**
   * Turns two-factor authentication off and forgets its secret and backup
   * codes. Resolves to false when it is not enabled.
   */
  disableTwoFactor(id: UserId): Promise<Result<boolean, DomainError>>

  /** Replaces the backup codes. Resolves to false when two-factor authentication is not enabled. */
  replaceBackupCodes(
    id: UserId,
    backupCodeHashes: string[],
  ): Promise<Result<boolean, DomainError>>
}
