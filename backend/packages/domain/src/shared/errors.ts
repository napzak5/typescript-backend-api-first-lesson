import type { LocalizedText } from '@beauty-salon-shared/i18n'

/** One rule that an input value broke. */
export type ValidationIssue = {
  /** Path of the offending value in dot notation; empty for the input as a whole. */
  field: string
  /** Identifier of the rule that was broken, e.g. `too_big`. */
  rule: string
  /** What the rule asks for, in every language. */
  message: LocalizedText
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
 * Every way a use case can fail. `validation` means the request breaks
 * rules; its `message`, the headline, and what it says of each rule are
 * written in every language. `database` covers both a failed query and
 * stored data that does not have the shape the schema promises
 * (`parseStored`); its `cause` is for logs and is never sent to a client.
 * `storage` is a call to the object storage that failed; its `cause` is
 * for logs as well. `forbidden`
 * means the actor is known and may not do this. `conflict` means the
 * request is fine and what it acts on is not in a state that allows it;
 * its `message` says why, in every language.
 * `passwordRequired` means that what the request asks for is behind a
 * password of its own, which nobody signs in with, and the request brought
 * none that is accepted: none at all, a wrong one, or any while the
 * password is locked. `notFound` and `alreadyExists` name what it is about
 * in every language (`entityMessages`); the `id` of `notFound` is null
 * when what the thing was looked for by is not to be repeated.
 */
export type DomainError =
  | { type: 'validation'; message: LocalizedText; issues: ValidationIssue[] }
  | { type: 'unauthenticated'; reason: AuthenticationFailure }
  | { type: 'forbidden' }
  | { type: 'passwordRequired' }
  | { type: 'notFound'; entity: LocalizedText; id: string | null }
  | {
      type: 'alreadyExists'
      entity: LocalizedText
      field: string
      value: string
    }
  | { type: 'conflict'; message: LocalizedText }
  | { type: 'database'; message: string; cause: unknown }
  | { type: 'storage'; message: string; cause: unknown }

export const DomainErrors = {
  validation(message: LocalizedText, issues: ValidationIssue[]): DomainError {
    return { type: 'validation', message, issues }
  },

  unauthenticated(reason: AuthenticationFailure): DomainError {
    return { type: 'unauthenticated', reason }
  },

  forbidden(): DomainError {
    return { type: 'forbidden' }
  },

  passwordRequired(): DomainError {
    return { type: 'passwordRequired' }
  },

  notFound(entity: LocalizedText, id: string | null): DomainError {
    return { type: 'notFound', entity, id }
  },

  alreadyExists(
    entity: LocalizedText,
    field: string,
    value: string,
  ): DomainError {
    return { type: 'alreadyExists', entity, field, value }
  },

  conflict(message: LocalizedText): DomainError {
    return { type: 'conflict', message }
  },

  database(message: string, cause: unknown): DomainError {
    return { type: 'database', message, cause }
  },

  storage(message: string, cause: unknown): DomainError {
    return { type: 'storage', message, cause }
  },
}
