/** One rule that an input value broke. */
export type ValidationIssue = {
  /** Path of the offending value in dot notation; empty for the input as a whole. */
  field: string
  /** Identifier of the rule that was broken, e.g. `too_big`. */
  rule: string
  message: string
}

/**
 * Why a request does not count as coming from a signed-in user.
 * - `missingCredentials`: no bearer token was sent
 * - `invalidToken`: the token names no session that can be used
 * - `expiredToken`: the session exists and its access token has run out;
 *   the client can get a new one with its refresh token
 * - `invalidCredentials`: a login failed, for whatever reason
 * - `twoFactorRequired`: the password of a login was right, and the code of
 *   the second factor is missing or was not accepted
 */
export type AuthenticationFailure =
  | 'missingCredentials'
  | 'invalidToken'
  | 'expiredToken'
  | 'invalidCredentials'
  | 'twoFactorRequired'

/**
 * Every way a use case can fail. `database` covers both a failed query and
 * stored data that does not have the shape the schema promises; its `cause`
 * is for logs and is never sent to a client. `forbidden` means the actor is
 * known and may not do this. `conflict` means the request is fine and what
 * it acts on is not in a state that allows it.
 */
export type DomainError =
  | { type: 'validation'; message: string; issues: ValidationIssue[] }
  | { type: 'unauthenticated'; reason: AuthenticationFailure }
  | { type: 'forbidden' }
  | { type: 'notFound'; entity: string; id: string }
  | { type: 'alreadyExists'; entity: string; field: string; value: string }
  | { type: 'conflict'; message: string }
  | { type: 'database'; message: string; cause: unknown }

export const DomainErrors = {
  validation(message: string, issues: ValidationIssue[]): DomainError {
    return { type: 'validation', message, issues }
  },

  unauthenticated(reason: AuthenticationFailure): DomainError {
    return { type: 'unauthenticated', reason }
  },

  forbidden(): DomainError {
    return { type: 'forbidden' }
  },

  notFound(entity: string, id: string): DomainError {
    return { type: 'notFound', entity, id }
  },

  alreadyExists(entity: string, field: string, value: string): DomainError {
    return { type: 'alreadyExists', entity, field, value }
  },

  conflict(message: string): DomainError {
    return { type: 'conflict', message }
  },

  database(message: string, cause: unknown): DomainError {
    return { type: 'database', message, cause }
  },
}
