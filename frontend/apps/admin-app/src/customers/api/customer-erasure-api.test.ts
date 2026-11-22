import {
  answering,
  asked,
  problem,
  record,
  sent,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { aDeletionRequest } from '../components/examples'
import {
  askForErasure,
  cancelErasureRequest,
  readErasureRequest,
} from './customer-erasure-api'

/*
 * What the API answers to the requests of a customer to have their data
 * erased is met with the real API (`customer-erasure.integration.test.tsx`).
 * Here are the answers a test cannot bring about there.
 */

const request = aDeletionRequest()

const CUSTOMER = request.customerId

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readErasureRequest', () => {
  it('should read the latest request of the customer', async () => {
    // Arrange
    const fetched = answering(() => record(200, request))

    // Act
    const read = await readErasureRequest(CUSTOMER)

    // Assert
    expect(read).toEqual({ type: 'read', request })
    expect(asked(fetched)).toEqual([
      `GET /customers/${CUSTOMER}/deletion-request`,
    ])
  })

  it('should take 404 as no request: the customer of the page is in the ledger, or was', async () => {
    // Arrange
    answering(() => problem(404))

    // Act
    const read = await readErasureRequest(CUSTOMER)

    // Assert
    expect(read).toEqual({ type: 'read', request: null })
  })

  it.each<[string, () => Response, string]>([
    ['403', () => problem(403), 'forbidden'],
    ['400', () => problem(400), 'failed'],
  ])('should take %s as %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const read = await readErasureRequest(CUSTOMER)

    // Assert
    expect(read).toEqual({ type })
  })

  it.each(UNREAD)('should read nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const read = await readErasureRequest(CUSTOMER)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('askForErasure', () => {
  it('should send the reason, and give the request that was taken', async () => {
    // Arrange
    const fetched = answering(() => record(202, request))

    // Act
    const asking = await askForErasure(CUSTOMER, { reason: ' 電話で ' })

    // Assert
    expect(asking).toEqual({ type: 'asked', request })
    expect(asked(fetched)).toEqual([
      `POST /customers/${CUSTOMER}/deletion-request`,
    ])
    expect(await sent(fetched)).toEqual([{ reason: ' 電話で ' }])
  })

  it('should name the values the API refused', async () => {
    // Arrange
    answering(() => problem(400, [{ field: 'reason', rule: 'too_big' }]))

    // Act
    const asking = await askForErasure(CUSTOMER, { reason: '理由' })

    // Assert
    expect(asking).toEqual({
      type: 'invalid',
      values: [{ field: 'reason', rule: 'too_big' }],
    })
  })

  it.each<[number, string]>([
    [409, 'pending'],
    [404, 'notFound'],
    [403, 'forbidden'],
    [413, 'failed'],
    [415, 'failed'],
  ])('should take %i as %s', async (status, type) => {
    // Arrange
    answering(() => problem(status))

    // Act
    const asking = await askForErasure(CUSTOMER, { reason: '理由' })

    // Assert
    expect(asking).toEqual({ type })
  })

  it.each(UNREAD)('should take nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const asking = await askForErasure(CUSTOMER, { reason: '理由' })

    // Assert
    expect(asking).toEqual({ type })
  })
})

describe('cancelErasureRequest', () => {
  it('should call off the pending request, and give it as it is now', async () => {
    // Arrange
    const cancelled = aDeletionRequest({
      status: 'cancelled',
      cancelledBy: request.requestedBy,
      cancelledAt: '2026-11-21T06:00:00.000Z',
    })
    const fetched = answering(() => record(200, cancelled))

    // Act
    const outcome = await cancelErasureRequest(CUSTOMER)

    // Assert
    expect(outcome).toEqual({ type: 'cancelled', request: cancelled })
    expect(asked(fetched)).toEqual([
      `DELETE /customers/${CUSTOMER}/deletion-request`,
    ])
  })

  it.each<[number, string]>([
    [404, 'notFound'],
    [403, 'forbidden'],
    [400, 'failed'],
  ])('should take %i as %s', async (status, type) => {
    // Arrange
    answering(() => problem(status))

    // Act
    const outcome = await cancelErasureRequest(CUSTOMER)

    // Assert
    expect(outcome).toEqual({ type })
  })

  it.each(UNREAD)(
    'should call off nothing after %s',
    async (_, answer, type) => {
      // Arrange
      answering(answer)

      // Act
      const outcome = await cancelErasureRequest(CUSTOMER)

      // Assert
      expect(outcome).toEqual({ type })
    },
  )
})
