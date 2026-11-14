import { describe, expect, it } from 'vitest'
import { describeDatabaseError } from '../failure'

/** The error postgres.js raises for a statement the server rejected. */
const uniqueViolation = Object.assign(
  new Error(
    'duplicate key value violates unique constraint "salons_email_unique"',
  ),
  {
    code: '23505',
    detail: 'Key (email)=(owner@salon.example) already exists.',
    table_name: 'salons',
    constraint_name: 'salons_email_unique',
  },
)

/** How drizzle reports a failed statement: the driver's error is the cause. */
const failedQuery = (cause: unknown) =>
  Object.assign(
    new Error(
      'Failed query: insert into "salons" ("email") values ($1)\nparams: owner@salon.example',
    ),
    {
      query: 'insert into "salons" ("email") values ($1)',
      params: ['owner@salon.example'],
      cause,
    },
  )

describe('describeDatabaseError', () => {
  it('should describe a rejected statement by the statement and the verdict', () => {
    expect(describeDatabaseError(failedQuery(uniqueViolation))).toEqual({
      message:
        'duplicate key value violates unique constraint "salons_email_unique"',
      code: '23505',
      constraint: 'salons_email_unique',
      table: 'salons',
      column: null,
      query: 'insert into "salons" ("email") values ($1)',
    })
  })

  it('should leave out the bound values', () => {
    const description = describeDatabaseError(failedQuery(uniqueViolation))

    expect(JSON.stringify(description)).not.toContain('owner@salon.example')
  })

  it('should describe a driver error that reached it unwrapped', () => {
    expect(describeDatabaseError(uniqueViolation)).toMatchObject({
      code: '23505',
      constraint: 'salons_email_unique',
      query: null,
    })
  })

  it('should describe a connection failure by its code', () => {
    const refused = Object.assign(
      new Error('connect ECONNREFUSED 127.0.0.1:5432'),
      { code: 'ECONNREFUSED' },
    )

    expect(describeDatabaseError(failedQuery(refused))).toMatchObject({
      message: 'connect ECONNREFUSED 127.0.0.1:5432',
      code: 'ECONNREFUSED',
      constraint: null,
    })
  })

  it('should not fall back to the message that lists the bound values', () => {
    expect(describeDatabaseError(failedQuery(undefined))).toEqual({
      message: 'Database query failed',
      code: null,
      constraint: null,
      table: null,
      column: null,
      query: 'insert into "salons" ("email") values ($1)',
    })
  })

  it('should describe something that is not an error', () => {
    expect(describeDatabaseError('boom')).toEqual({
      message: 'Database query failed',
      code: null,
      constraint: null,
      table: null,
      column: null,
      query: null,
    })
  })
})
