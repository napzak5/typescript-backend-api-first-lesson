/** A new secret for time-based one-time passwords. */
export type IssuedTwoFactorSecret = {
  /** What the user's authenticator app is given, in Base32. Shown once. */
  secret: string
  /** The same secret as it is stored: encrypted, readable by the server only. */
  sealed: string
}

/**
 * The second factor of a login: one-time passwords that an authenticator
 * app derives from a shared secret and the time (TOTP, RFC 6238), and the
 * backup codes a user falls back on without the app.
 */
export interface ITwoFactorAuthenticator {
  issueSecret(): IssuedTwoFactorSecret

  /** The backup codes of one user, as they are shown: random, each good for one use. */
  issueBackupCodes(): string[]

  /**
   * The time step whose one-time password `code` is, for the secret stored
   * as `sealed`. The step of `now` and its neighbours are looked at, which
   * allows for a clock that is a little off. Null when the code belongs to
   * none of them, and when `sealed` is not a secret this server can read.
   * A caller accepts each step once.
   */
  matchingStep(sealed: string, code: string, now: Date): number | null
}
