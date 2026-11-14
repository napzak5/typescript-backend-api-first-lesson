import { DomainErrors } from '@beauty-salon-backend/domain'
import { describe, expect, it } from 'vitest'
import { toProblemDetails } from '../problem-details'

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
})
