import {
  page,
  problem,
  problemWithCode,
  record,
} from '@beauty-salon-frontend/testing/answers'
import { describe, expect, it } from 'vitest'
import type {
  ModelsProblemDetails,
  SalonCrudGet200,
  SalonCrudList200,
} from './index'

/*
 * The answers of the API that the tests of the applications make up
 * (`@beauty-salon-frontend/testing/answers`) are answers of the contract.
 * That package cannot depend on this one, so the types the contract is
 * generated into are held against its answers here. Every expectation is a
 * value of a generated type and is compared in full: a property the
 * contract gains, loses or types otherwise fails the type check of this
 * file, and then the test, until the answer the tests make up follows.
 */

/** What wraps one record in the answers of the contract: that of a salon, whatever the record. */
type Wrapping = Omit<SalonCrudGet200, 'data'>

/** What wraps a page of a list in the answers of the contract: that of the salons, whatever the items. */
type Paging = Omit<SalonCrudList200, 'data'>

const PROBLEM: ModelsProblemDetails = {
  type: 'urn:beauty-salon:problem',
  title: 'Problem',
  status: 429,
  detail: null,
  instance: null,
  code: '2001',
  errors: null,
  correlationId: null,
  timestamp: '2026-11-20T00:00:00.000Z',
}

describe('the answers of the API the tests make up', () => {
  it('should make up a problem as the contract describes one', async () => {
    // Act
    const answer = problem(429)

    // Assert
    expect(await answer.json()).toStrictEqual(PROBLEM)
  })

  it('should make up a refused value as the contract describes one', async () => {
    // Arrange
    const described: ModelsProblemDetails = {
      ...PROBLEM,
      status: 422,
      errors: [
        {
          field: 'name',
          rule: 'required',
          message: 'Invalid',
          value: null,
          constraint: null,
        },
      ],
    }

    // Act
    const answer = problem(422, [{ field: 'name', rule: 'required' }])

    // Assert
    expect(await answer.json()).toStrictEqual(described)
  })

  it('should make up a problem with a code and a detail as the contract describes one', async () => {
    // Arrange
    const described: ModelsProblemDetails = {
      ...PROBLEM,
      status: 409,
      code: '3002',
      detail: 'It is taken',
    }

    // Act
    const answer = problemWithCode(409, '3002', 'It is taken')

    // Assert
    expect(await answer.json()).toStrictEqual(described)
  })

  it('should wrap one record as the contract wraps one', async () => {
    // Arrange
    const wrapping: Wrapping = { meta: null, links: null }

    // Act
    const answer = record(200, { id: 'a' })

    // Assert
    expect(await answer.json()).toStrictEqual({
      data: { id: 'a' },
      ...wrapping,
    })
  })

  it('should wrap the last page of a list as the contract wraps a page', async () => {
    // Arrange
    const paging: Paging = {
      meta: {
        total: 2,
        limit: 100,
        hasMore: false,
        cursor: null,
        nextCursor: null,
        prevCursor: null,
      },
      links: { self: '/', first: null, last: null, next: null, prev: null },
    }

    // Act
    const answer = page([{ id: 'a' }, { id: 'b' }])

    // Assert
    expect(await answer.json()).toStrictEqual({
      data: [{ id: 'a' }, { id: 'b' }],
      ...paging,
    })
  })

  it.each<[string, number | null]>([
    ['a list that counts its items', 7],
    ['a list that does not', null],
  ])(
    'should wrap a page that another follows as the contract wraps a page: %s',
    async (_, total) => {
      // Arrange
      const paging: Paging = {
        meta: {
          total,
          limit: 100,
          hasMore: true,
          cursor: null,
          nextCursor: 'a',
          prevCursor: null,
        },
        links: { self: '/', first: null, last: null, next: null, prev: null },
      }

      // Act
      const answer = page([{ id: 'a' }], 'a', total)

      // Assert
      expect(await answer.json()).toStrictEqual({
        data: [{ id: 'a' }],
        ...paging,
      })
    },
  )
})
