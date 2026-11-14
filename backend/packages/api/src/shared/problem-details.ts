import type { DomainError } from '@beauty-salon-backend/domain'
import type { components } from '@beauty-salon-backend/generated'
import { match } from 'ts-pattern'

export type ProblemDetails = components['schemas']['Models.ProblemDetails']

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

const toProblem = (error: DomainError): Problem =>
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
    .exhaustive()

/** Domain error → RFC 9457 problem details. */
export const toProblemDetails = (
  error: DomainError,
  context: ProblemContext,
): ProblemDetails => ({ ...toProblem(error), ...context })
