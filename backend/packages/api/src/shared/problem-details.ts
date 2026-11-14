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
    // The cause stays on the server: it may name tables, columns or data.
    .with({ type: 'database' }, () => ({
      type: 'urn:beauty-salon:problem:database',
      title: 'Internal server error',
      status: 500,
      detail: null,
      code: '4003',
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

/** Error → RFC 9457 problem details. */
export const toProblemDetails = (
  error: ApiError,
  context: ProblemContext,
): ProblemDetails => ({ ...toProblem(error), ...context })
