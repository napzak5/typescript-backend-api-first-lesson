import {
  type DomainError,
  isToldInEveryLanguage,
  toldIn,
} from '@beauty-salon-backend/domain'
import type { components } from '@beauty-salon-backend/generated'
import {
  type Locale,
  type LocalizedText,
  textIn,
} from '@beauty-salon-shared/i18n'
import { problemMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match, P } from 'ts-pattern'

export type ProblemDetails = components['schemas']['Models.ProblemDetails']

/** The largest request body the API reads. */
export const BODY_LIMIT_BYTES = 100_000

/** What goes wrong in the HTTP layer itself, outside any use case. */
export type HttpError =
  | { type: 'routeNotFound'; method: string; path: string }
  | { type: 'malformedBody' }
  | { type: 'unsupportedMediaType' }
  | { type: 'bodyTooLarge' }
  | { type: 'badRequest' }
  | { type: 'rateLimited' }
  | { type: 'unexpected' }

/** Everything the API answers with problem details. */
export type ApiError = DomainError | HttpError

/** The part of a problem that the kind of error decides. */
type Problem = Pick<
  ProblemDetails,
  'type' | 'title' | 'status' | 'detail' | 'code' | 'errors'
>

/** What identifies the response that carries the problem. */
export type ProblemContext = Pick<
  ProblemDetails,
  'instance' | 'correlationId' | 'timestamp'
>

/**
 * The language of what the domain writes of an error: the detail of an
 * error that names what was wrong with the request or with what it acts on.
 */
const LANGUAGE_OF_THE_DOMAIN: Locale = 'en'

/**
 * The language a problem is told in: the one that was asked for, where
 * every text of the error is written in it. A text that the domain writes
 * in one language alone is told in that language, and so is the error as a
 * whole: no answer is in two languages, and `Content-Language` names the
 * one it is in. What a validation error says of each broken rule is
 * written in every language, so the error is when its headline is.
 * Every kind of error is named, so a new one does not compile until it is
 * said who writes its detail.
 */
export const languageOf = (error: ApiError, asked: Locale): Locale =>
  match(error)
    .with({ type: 'validation' }, ({ message }) =>
      isToldInEveryLanguage(message) ? asked : LANGUAGE_OF_THE_DOMAIN,
    )
    .with(
      { type: P.union('notFound', 'alreadyExists', 'conflict') },
      () => LANGUAGE_OF_THE_DOMAIN,
    )
    .with(
      {
        type: P.union(
          'unauthenticated',
          'forbidden',
          'passwordRequired',
          'database',
          'storage',
          'routeNotFound',
          'malformedBody',
          'unsupportedMediaType',
          'bodyTooLarge',
          'badRequest',
          'rateLimited',
          'unexpected',
        ),
      },
      () => asked,
    )
    .exhaustive()

const toProblem = (error: ApiError, language: Locale): Problem => {
  const said = (text: LocalizedText): string => textIn(text, language)

  return (
    match(error)
      .returnType<Problem>()
      .with({ type: 'validation' }, ({ message, issues }) => ({
        type: 'urn:beauty-salon:problem:validation',
        title: said(problemMessages.validation.title),
        status: 400,
        detail: toldIn(message, language),
        code: '2001',
        errors: issues.map(({ field, rule, message: issueMessage }) => ({
          field,
          rule,
          message: said(issueMessage),
          value: null,
          constraint: null,
        })),
      }))
      .with({ type: 'unauthenticated', reason: 'missingCredentials' }, () => ({
        type: 'urn:beauty-salon:problem:authentication-required',
        title: said(problemMessages.authenticationRequired.title),
        status: 401,
        detail: said(problemMessages.authenticationRequired.detail),
        code: '1001',
        errors: null,
      }))
      .with({ type: 'unauthenticated', reason: 'invalidToken' }, () => ({
        type: 'urn:beauty-salon:problem:invalid-token',
        title: said(problemMessages.invalidToken.title),
        status: 401,
        detail: said(problemMessages.invalidToken.detail),
        code: '1004',
        errors: null,
      }))
      .with({ type: 'unauthenticated', reason: 'expiredToken' }, () => ({
        type: 'urn:beauty-salon:problem:token-expired',
        title: said(problemMessages.tokenExpired.title),
        status: 401,
        detail: said(problemMessages.tokenExpired.detail),
        code: '1003',
        errors: null,
      }))
      // The same for every cause, so that the answer does not say whether the
      // email is registered or what is wrong with the account.
      .with({ type: 'unauthenticated', reason: 'invalidCredentials' }, () => ({
        type: 'urn:beauty-salon:problem:invalid-credentials',
        title: said(problemMessages.invalidCredentials.title),
        status: 401,
        detail: said(problemMessages.invalidCredentials.detail),
        code: '1002',
        errors: null,
      }))
      // The password was right. Says nothing about the code: missing, wrong and
      // already used are answered alike.
      .with({ type: 'unauthenticated', reason: 'twoFactorRequired' }, () => ({
        type: 'urn:beauty-salon:problem:two-factor-required',
        title: said(problemMessages.twoFactorRequired.title),
        status: 401,
        detail: said(problemMessages.twoFactorRequired.detail),
        code: '1007',
        errors: null,
      }))
      .with({ type: 'forbidden' }, () => ({
        type: 'urn:beauty-salon:problem:forbidden',
        title: said(problemMessages.forbidden.title),
        status: 403,
        detail: said(problemMessages.forbidden.detail),
        code: '1005',
        errors: null,
      }))
      // 403 and not 401: the password travels in the body, so there is no
      // challenge to send with a 401 (RFC 9110, 15.5.2), and a 403 is what
      // tells a client that other credentials may do (15.5.4). The same for a
      // missing password, a wrong one and a locked link.
      .with({ type: 'passwordRequired' }, () => ({
        type: 'urn:beauty-salon:problem:password-required',
        title: said(problemMessages.passwordRequired.title),
        status: 403,
        detail: said(problemMessages.passwordRequired.detail),
        code: '1002',
        errors: null,
      }))
      .with({ type: 'notFound' }, ({ entity, id }) => ({
        type: 'urn:beauty-salon:problem:not-found',
        title: said(problemMessages.notFound.title),
        status: 404,
        detail: `${entity} ${id} was not found`,
        code: '3001',
        errors: null,
      }))
      .with({ type: 'alreadyExists' }, ({ entity, field, value }) => ({
        type: 'urn:beauty-salon:problem:already-exists',
        title: said(problemMessages.alreadyExists.title),
        status: 409,
        detail: `${entity} with ${field} ${value} already exists`,
        code: '3002',
        errors: null,
      }))
      .with({ type: 'conflict' }, ({ message }) => ({
        type: 'urn:beauty-salon:problem:operation-not-allowed',
        title: said(problemMessages.conflict.title),
        status: 409,
        detail: message,
        code: '3003',
        errors: null,
      }))
      // The cause stays on the server: it may name tables, columns or data.
      .with({ type: 'database' }, () => ({
        type: 'urn:beauty-salon:problem:database',
        title: said(problemMessages.internal.title),
        status: 500,
        detail: null,
        code: '4003',
        errors: null,
      }))
      // So does the cause of a failure of the object storage.
      .with({ type: 'storage' }, () => ({
        type: 'urn:beauty-salon:problem:storage',
        title: said(problemMessages.internal.title),
        status: 500,
        detail: null,
        code: '4004',
        errors: null,
      }))
      .with({ type: 'routeNotFound' }, ({ method, path }) => ({
        type: 'urn:beauty-salon:problem:route-not-found',
        title: said(problemMessages.routeNotFound.title),
        status: 404,
        detail: said(problemMessages.routeNotFound.detail(method, path)),
        code: '3001',
        errors: null,
      }))
      .with({ type: 'malformedBody' }, () => ({
        type: 'urn:beauty-salon:problem:malformed-body',
        title: said(problemMessages.malformedBody.title),
        status: 400,
        detail: said(problemMessages.malformedBody.detail),
        code: '2002',
        errors: null,
      }))
      .with({ type: 'unsupportedMediaType' }, () => ({
        type: 'urn:beauty-salon:problem:unsupported-media-type',
        title: said(problemMessages.unsupportedMediaType.title),
        status: 415,
        detail: said(problemMessages.unsupportedMediaType.detail),
        code: '2002',
        errors: null,
      }))
      .with({ type: 'bodyTooLarge' }, () => ({
        type: 'urn:beauty-salon:problem:body-too-large',
        title: said(problemMessages.bodyTooLarge.title),
        status: 413,
        detail: said(problemMessages.bodyTooLarge.detail(BODY_LIMIT_BYTES)),
        code: '2004',
        errors: null,
      }))
      .with({ type: 'badRequest' }, () => ({
        type: 'urn:beauty-salon:problem:bad-request',
        title: said(problemMessages.badRequest.title),
        status: 400,
        detail: null,
        code: '2002',
        errors: null,
      }))
      .with({ type: 'rateLimited' }, () => ({
        type: 'urn:beauty-salon:problem:rate-limited',
        title: said(problemMessages.rateLimited.title),
        status: 429,
        detail: said(problemMessages.rateLimited.detail),
        code: '4005',
        errors: null,
      }))
      // Nothing about a failure nobody anticipated is safe to show.
      .with({ type: 'unexpected' }, () => ({
        type: 'urn:beauty-salon:problem:internal',
        title: said(problemMessages.internal.title),
        status: 500,
        detail: null,
        code: '4001',
        errors: null,
      }))
      .exhaustive()
  )
}

const BEARER_REALM = 'beauty-salon-api'

/**
 * The `WWW-Authenticate` challenge of a 401 response, which RFC 9110 requires
 * (section 15.5.2); null for every other error. `error="invalid_token"` is
 * added when a token was sent and did not work, and left out when none was
 * sent (RFC 6750, section 3).
 */
export const toBearerChallenge = (error: ApiError): string | null =>
  error.type === 'unauthenticated'
    ? match(error.reason)
        .with(
          'missingCredentials',
          'invalidCredentials',
          'twoFactorRequired',
          () => `Bearer realm="${BEARER_REALM}"`,
        )
        .with(
          'invalidToken',
          'expiredToken',
          () => `Bearer realm="${BEARER_REALM}", error="invalid_token"`,
        )
        .exhaustive()
    : null

/**
 * Error → RFC 9457 problem details, told in the language that was asked
 * for where the error is written in it (`languageOf`).
 */
export const toProblemDetails = (
  error: ApiError,
  context: ProblemContext,
  asked: Locale,
): ProblemDetails => ({
  ...toProblem(error, languageOf(error, asked)),
  ...context,
})
