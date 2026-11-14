import { DomainErrors } from '@beauty-salon-backend/domain'
import { describe, expect, it } from 'vitest'
import {
  type HttpError,
  type ProblemDetails,
  toProblemDetails,
} from '../problem-details'

const context = {
  instance: '/api/v1/salons',
  correlationId: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b',
  timestamp: '2026-11-14T09:00:00.000Z',
}

describe('toProblemDetails', () => {
  it('presents a validation error as 400 with one entry per broken rule', () => {
    const problem = toProblemDetails(
      DomainErrors.validation('Invalid salon', [
        { field: 'email', rule: 'invalid_format', message: 'Invalid email' },
        { field: 'openingHours.0.date', rule: 'custom', message: 'Repeated' },
      ]),
      context,
    )

    expect(problem).toEqual({
      type: 'urn:beauty-salon:problem:validation',
      title: 'Validation failed',
      status: 400,
      detail: 'Invalid salon',
      code: '2001',
      errors: [
        {
          field: 'email',
          rule: 'invalid_format',
          message: 'Invalid email',
          value: null,
          constraint: null,
        },
        {
          field: 'openingHours.0.date',
          rule: 'custom',
          message: 'Repeated',
          value: null,
          constraint: null,
        },
      ],
      ...context,
    })
  })

  it('presents a missing entity as 404', () => {
    const problem = toProblemDetails(
      DomainErrors.notFound('Salon', '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c'),
      context,
    )

    expect(problem).toMatchObject({
      type: 'urn:beauty-salon:problem:not-found',
      status: 404,
      detail: 'Salon 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c was not found',
      code: '3001',
      errors: null,
    })
  })

  it('presents a duplicate as 409 naming the property and the value', () => {
    const problem = toProblemDetails(
      DomainErrors.alreadyExists('Salon', 'email', 'aoyama@example.com'),
      context,
    )

    expect(problem).toMatchObject({
      type: 'urn:beauty-salon:problem:already-exists',
      status: 409,
      detail: 'Salon with email aoyama@example.com already exists',
      code: '3002',
      errors: null,
    })
  })

  it('presents a database error as 500 without revealing its message or cause', () => {
    const problem = toProblemDetails(
      DomainErrors.database(
        'Failed to create salon',
        new Error('relation "salons" does not exist'),
      ),
      context,
    )

    expect(problem).toEqual({
      type: 'urn:beauty-salon:problem:database',
      title: 'Internal server error',
      status: 500,
      detail: null,
      code: '4003',
      errors: null,
      ...context,
    })
    expect(JSON.stringify(problem)).not.toContain('salons" does not exist')
  })

  it.each<
    [HttpError, Pick<ProblemDetails, 'type' | 'status' | 'code' | 'detail'>]
  >([
    [
      { type: 'routeNotFound', method: 'PUT', path: '/api/v1/salons' },
      {
        type: 'urn:beauty-salon:problem:route-not-found',
        status: 404,
        code: '3001',
        detail: 'PUT /api/v1/salons is not part of the API',
      },
    ],
    [
      { type: 'malformedBody' },
      {
        type: 'urn:beauty-salon:problem:malformed-body',
        status: 400,
        code: '2002',
        detail: 'The request body is not valid JSON',
      },
    ],
    [
      { type: 'unsupportedMediaType' },
      {
        type: 'urn:beauty-salon:problem:unsupported-media-type',
        status: 415,
        code: '2002',
        detail: 'The request body must be application/json in UTF-8',
      },
    ],
    [
      { type: 'bodyTooLarge' },
      {
        type: 'urn:beauty-salon:problem:body-too-large',
        status: 413,
        code: '2004',
        detail: 'The request body exceeds 100000 bytes',
      },
    ],
    [
      { type: 'badRequest' },
      {
        type: 'urn:beauty-salon:problem:bad-request',
        status: 400,
        code: '2002',
        detail: null,
      },
    ],
    [
      { type: 'rateLimited' },
      {
        type: 'urn:beauty-salon:problem:rate-limited',
        status: 429,
        code: '4005',
        detail: 'Wait for the time in the Retry-After header before retrying',
      },
    ],
    [
      { type: 'unexpected' },
      {
        type: 'urn:beauty-salon:problem:internal',
        status: 500,
        code: '4001',
        detail: null,
      },
    ],
  ])(
    'presents the HTTP error %j with its own type, status and code',
    (error, expected) => {
      expect(toProblemDetails(error, context)).toEqual({
        ...expected,
        title: expect.any(String),
        errors: null,
        ...context,
      })
    },
  )
})
