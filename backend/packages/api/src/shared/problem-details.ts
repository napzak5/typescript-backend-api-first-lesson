import type { DomainError } from '@beauty-salon-backend/domain'
import type { components } from '@beauty-salon-backend/generated'
import { match } from 'ts-pattern'

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

const toProblem = (error: ApiError): Problem =>
  match(error)
    .returnType<Problem>()
    .with({ type: 'validation' }, ({ message, issues }) => ({
      type: 'urn:beauty-salon:problem:validation',
      title: 'Validation failed',
      status: 400,
      detail: message,
      code: '2001',
      errors: issues.map(({ field, rule, message: issueMessage }) => ({
        field,
        rule,
        message: issueMessage,
        value: null,
        constraint: null,
      })),
    }))
    .with({ type: 'unauthenticated', reason: 'missingCredentials' }, () => ({
      type: 'urn:beauty-salon:problem:authentication-required',
      title: 'Authentication required',
      status: 401,
      detail:
        'Send the access token in the Authorization header as a Bearer token',
      code: '1001',
      errors: null,
    }))
    .with({ type: 'unauthenticated', reason: 'invalidToken' }, () => ({
      type: 'urn:beauty-salon:problem:invalid-token',
      title: 'Invalid token',
      status: 401,
      detail: 'The token cannot be used; sign in again',
      code: '1004',
      errors: null,
    }))
    .with({ type: 'unauthenticated', reason: 'expiredToken' }, () => ({
      type: 'urn:beauty-salon:problem:token-expired',
      title: 'Token expired',
      status: 401,
      detail:
        'The access token has expired; get a new one with the refresh token',
      code: '1003',
      errors: null,
    }))
    // The same for every cause, so that the answer does not say whether the
    // email is registered or what is wrong with the account.
    .with({ type: 'unauthenticated', reason: 'invalidCredentials' }, () => ({
      type: 'urn:beauty-salon:problem:invalid-credentials',
      title: 'Login failed',
      status: 401,
      detail: 'Invalid email or password',
      code: '1002',
      errors: null,
    }))
    // The password was right. Says nothing about the code: missing, wrong and
    // already used are answered alike.
    .with({ type: 'unauthenticated', reason: 'twoFactorRequired' }, () => ({
      type: 'urn:beauty-salon:problem:two-factor-required',
      title: 'Two-factor authentication required',
      status: 401,
      detail:
        'Send a valid code of the authenticator app, or a backup code, as twoFactorCode',
      code: '1007',
      errors: null,
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'urn:beauty-salon:problem:forbidden',
      title: 'Forbidden',
      status: 403,
      detail: 'This account is not allowed to do this',
      code: '1005',
      errors: null,
    }))
    .with({ type: 'notFound' }, ({ entity, id }) => ({
      type: 'urn:beauty-salon:problem:not-found',
      title: 'Resource not found',
      status: 404,
      detail: `${entity} ${id} was not found`,
      code: '3001',
      errors: null,
    }))
    .with({ type: 'alreadyExists' }, ({ entity, field, value }) => ({
      type: 'urn:beauty-salon:problem:already-exists',
      title: 'Resource already exists',
      status: 409,
      detail: `${entity} with ${field} ${value} already exists`,
      code: '3002',
      errors: null,
    }))
    .with({ type: 'conflict' }, ({ message }) => ({
      type: 'urn:beauty-salon:problem:operation-not-allowed',
      title: 'Operation not allowed',
      status: 409,
      detail: message,
      code: '3003',
      errors: null,
    }))
    // The cause stays on the server: it may name tables, columns or data.
    .with({ type: 'database' }, () => ({
      type: 'urn:beauty-salon:problem:database',
      title: 'Internal server error',
      status: 500,
      detail: null,
      code: '4003',
      errors: null,
    }))
    // So does the cause of a failure of the object storage.
    .with({ type: 'storage' }, () => ({
      type: 'urn:beauty-salon:problem:storage',
      title: 'Internal server error',
      status: 500,
      detail: null,
      code: '4004',
      errors: null,
    }))
    .with({ type: 'routeNotFound' }, ({ method, path }) => ({
      type: 'urn:beauty-salon:problem:route-not-found',
      title: 'Route not found',
      status: 404,
      detail: `${method} ${path} is not part of the API`,
      code: '3001',
      errors: null,
    }))
    .with({ type: 'malformedBody' }, () => ({
      type: 'urn:beauty-salon:problem:malformed-body',
      title: 'Malformed request body',
      status: 400,
      detail: 'The request body is not valid JSON',
      code: '2002',
      errors: null,
    }))
    .with({ type: 'unsupportedMediaType' }, () => ({
      type: 'urn:beauty-salon:problem:unsupported-media-type',
      title: 'Unsupported media type',
      status: 415,
      detail: 'The request body must be application/json in UTF-8',
      code: '2002',
      errors: null,
    }))
    .with({ type: 'bodyTooLarge' }, () => ({
      type: 'urn:beauty-salon:problem:body-too-large',
      title: 'Request body too large',
      status: 413,
      detail: `The request body exceeds ${BODY_LIMIT_BYTES} bytes`,
      code: '2004',
      errors: null,
    }))
    .with({ type: 'badRequest' }, () => ({
      type: 'urn:beauty-salon:problem:bad-request',
      title: 'Bad request',
      status: 400,
      detail: null,
      code: '2002',
      errors: null,
    }))
    .with({ type: 'rateLimited' }, () => ({
      type: 'urn:beauty-salon:problem:rate-limited',
      title: 'Too many requests',
      status: 429,
      detail: 'Wait for the time in the Retry-After header before retrying',
      code: '4005',
      errors: null,
    }))
    // Nothing about a failure nobody anticipated is safe to show.
    .with({ type: 'unexpected' }, () => ({
      type: 'urn:beauty-salon:problem:internal',
      title: 'Internal server error',
      status: 500,
      detail: null,
      code: '4001',
      errors: null,
    }))
    .exhaustive()

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

/** Error → RFC 9457 problem details. */
export const toProblemDetails = (
  error: ApiError,
  context: ProblemContext,
): ProblemDetails => ({ ...toProblem(error), ...context })
