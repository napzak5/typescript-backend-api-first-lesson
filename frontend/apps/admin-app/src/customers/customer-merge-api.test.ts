import type {
  ModelsCustomerDeletionRequestResponse,
  ModelsCustomerDeletionRequestStatusType,
} from '@beauty-salon-frontend/api-client'
import {
  answering,
  json,
  problem,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { aCustomer, customers } from '../bookings/components/examples'
import type { MergePair } from './customer-merge'
import { mergeCustomers, readMerge } from './customer-merge-api'

/*
 * What the API answers to a merge is met with the real API
 * (`customer-merge.integration.test.tsx`). Here are the answers a test
 * cannot bring about there.
 */

const [hanako = aCustomer(), ichiro = aCustomer()] = customers

const PAIR: MergePair = { primary: hanako, secondary: ichiro }

const customerAnswer = (): Response =>
  json(200, {
    data: ichiro,
    meta: null,
    links: { self: `/api/v1/customers/${ichiro.id}` },
  })

/** A request of the customer of the ID to have their data erased, in the state given */
const erasureRequestOf = (
  customerId: string,
  status: ModelsCustomerDeletionRequestStatusType,
): ModelsCustomerDeletionRequestResponse => ({
  id: '5f4e3d2c-1b0a-4f9e-8d7c-6b5a4f3e2d1c',
  customerId,
  reason: 'ご本人からのお申し出',
  status,
  requestedBy: '9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d',
  requestedAt: '2026-11-01T00:00:00.000Z',
  scheduledAt: '2026-11-15T00:00:00.000Z',
  cancelledBy:
    status === 'cancelled' ? '9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d' : null,
  cancelledAt: status === 'cancelled' ? '2026-11-02T00:00:00.000Z' : null,
  completedBy: null,
  completedAt: null,
})

describe('readMerge', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each<[ModelsCustomerDeletionRequestStatusType, boolean]>([
    ['pending', true],
    ['cancelled', false],
  ])(
    'should take a request of erasure that is %s as asked: %s',
    async (status, asked) => {
      // Arrange
      answering((request) => {
        const customerId = request.url.includes(hanako.id)
          ? hanako.id
          : ichiro.id
        if (request.url.includes('/deletion-request')) {
          return json(200, {
            data: erasureRequestOf(customerId, status),
            meta: null,
            links: { self: `/api/v1/customers/${customerId}/deletion-request` },
          })
        }
        return request.url.includes('/medical-charts/customer/')
          ? problem(404)
          : customerAnswer()
      })

      // Act
      const read = await readMerge(hanako.id, ichiro.id)

      // Assert
      expect(read).toEqual({
        type: 'found',
        other: ichiro,
        records: {
          erasureAsked: { this: asked, other: asked },
          charts: { this: null, other: null },
        },
      })
    },
  )

  it.each<[string, string, () => Response | Promise<Response>, string]>([
    [
      'the request of erasure',
      '/deletion-request',
      () => problem(403),
      'failed',
    ],
    [
      'the request of erasure',
      '/deletion-request',
      () => problem(400),
      'failed',
    ],
    ['the chart', '/medical-charts/customer/', () => problem(403), 'failed'],
    [
      'the chart',
      '/medical-charts/customer/',
      () => problem(429),
      'tooManyRequests',
    ],
    ...UNREAD.map(
      ([name, answer, type]): [
        string,
        string,
        () => Response | Promise<Response>,
        string,
      ] => [`the chart (${name})`, '/medical-charts/customer/', answer, type],
    ),
  ])('should tell when %s is not read', async (_, path, answer, type) => {
    // Arrange
    answering((request) =>
      request.url.includes(path) ? answer() : customerAnswer(),
    )

    // Act
    const read = await readMerge(hanako.id, ichiro.id)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('mergeCustomers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each<[string, () => Response | Promise<Response>, string]>([
    ['an account that may not', () => problem(403), 'forbidden'],
    [
      'a value the API refuses that is no customer gone',
      () =>
        problem(400, [{ field: 'conflictResolution', rule: 'invalid_value' }]),
      'failed',
    ],
    ['a body larger than the API takes', () => problem(413), 'failed'],
    ['a body the API does not take', () => problem(415), 'failed'],
    ...UNREAD,
  ])('should tell %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const attempt = await mergeCustomers(PAIR, 'keep_primary')

    // Assert
    expect(attempt).toEqual({ type })
  })

  it('should name both customers when both are gone', async () => {
    // Arrange
    answering(() =>
      problem(400, [
        { field: 'primaryCustomerId', rule: 'not_found' },
        { field: 'secondaryCustomerId', rule: 'not_found' },
      ]),
    )

    // Act
    const attempt = await mergeCustomers(PAIR, 'keep_newest')

    // Assert
    expect(attempt).toEqual({ type: 'gone', sides: ['primary', 'secondary'] })
  })
})
