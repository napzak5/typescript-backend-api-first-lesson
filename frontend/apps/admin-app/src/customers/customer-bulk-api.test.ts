import {
  answering,
  json,
  problem,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { aCustomer, customers } from '../bookings/components/examples'
import {
  registerCustomers,
  removeCustomers,
  retagCustomers,
} from './customer-bulk-api'
import type { FileCustomer } from './customer-file'

/*
 * What the API answers to the writes of many customers is met with the
 * real API (`customer-bulk.integration.test.tsx`). Here are the answers a
 * test cannot bring about there.
 */

const [hanako = aCustomer(), ichiro = aCustomer()] = customers

const ids = [hanako.id, ichiro.id]

const FILE: FileCustomer[] = [
  {
    row: 2,
    request: {
      lastName: '山田',
      firstName: '花子',
      lastNameKana: null,
      firstNameKana: null,
      email: 'hanako@example.com',
      phoneNumber: '090-1234-5678',
      alternativePhone: null,
      postalCode: null,
      prefecture: null,
      city: null,
      address: null,
      building: null,
      birthDate: null,
      gender: null,
      occupation: null,
      membershipTier: 'regular',
      preferences: null,
      notes: null,
      internalNotes: null,
      tags: [],
      referredBy: null,
      referralCode: null,
      allowMarketing: false,
      allowSms: false,
      allowEmail: false,
      isActive: true,
      hairType: null,
      hairThickness: null,
      scalpCondition: null,
      customerStatus: 'active',
    },
  },
]

/** The answer of the batch read, with the customers given */
const readAnswer = (found: readonly unknown[]): Response =>
  json(200, { data: found, meta: null, links: { list: '/api/v1/customers' } })

const problemSaying = (status: number, detail: string): Response =>
  json(
    status,
    {
      type: 'urn:beauty-salon:problem',
      title: 'Problem',
      status,
      detail,
      instance: null,
      code: '3003',
      errors: null,
      correlationId: null,
      timestamp: '2026-11-20T00:00:00.000Z',
    },
    'application/problem+json',
  )

describe('registerCustomers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should send the customers of the file in the order of their rows', async () => {
    // Arrange
    const fetched = answering(() =>
      json(201, {
        data: { created: [hanako.id] },
        meta: null,
        links: { list: '/api/v1/customers' },
      }),
    )

    // Act
    const attempt = await registerCustomers(FILE)

    // Assert
    expect(attempt).toEqual({ type: 'registered', count: 1 })
    expect(JSON.parse(String(fetched.mock.calls[0]?.[1]?.body))).toEqual({
      items: FILE.map(({ request }) => request),
    })
  })

  it.each<[string, () => Response | Promise<Response>, string]>([
    ['an account that may not', () => problem(403), 'forbidden'],
    ['a body the API does not take', () => problem(415), 'failed'],
    ['a body larger than the API takes', () => problem(413), 'tooLarge'],
    ...UNREAD,
  ])('should tell %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const attempt = await registerCustomers(FILE)

    // Assert
    expect(attempt).toEqual({ type })
  })
})

describe('retagCustomers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each<[string, () => Response | Promise<Response>, string]>([
    ['an account that may not', () => problem(403), 'forbidden'],
    ['a value the API refuses', () => problem(400), 'failed'],
    ['a conflict', () => problem(409), 'failed'],
    ['a body larger than the API takes', () => problem(413), 'failed'],
    ['a body the API does not take', () => problem(415), 'failed'],
    ...UNREAD,
  ])('should tell %s when the tags are sent', async (_, answer, type) => {
    // Arrange
    answering((request) =>
      request.url.endsWith('/batch/get') ? readAnswer([hanako]) : answer(),
    )

    // Act
    const attempt = await retagCustomers([hanako.id], {
      way: 'add',
      tag: '秋',
    })

    // Assert
    expect(attempt).toEqual({ type })
  })

  it.each(UNREAD)(
    'should send nothing when the chosen customers cannot be read anew: %s',
    async (_, answer, type) => {
      // Arrange
      const fetched = answering(answer)

      // Act
      const attempt = await retagCustomers(ids, { way: 'add', tag: '秋' })

      // Assert
      expect(attempt).toEqual({ type })
      expect(
        fetched.mock.calls.every(([input]) =>
          String(input).endsWith('/batch/get'),
        ),
      ).toBe(true)
    },
  )

  it('should name those removed between the read and the write', async () => {
    // Arrange
    let reads = 0
    answering((request) => {
      if (request.url.endsWith('/batch/get')) {
        reads += 1
        return reads === 1 ? readAnswer([hanako, ichiro]) : problem(404)
      }
      return problem(404)
    })

    // Act
    const attempt = await retagCustomers(ids, { way: 'add', tag: '秋' })

    // Assert: one by one, after the batch read was refused
    expect(attempt).toEqual({ type: 'gone', ids })
  })
})

describe('removeCustomers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should name no customer when the API names none of the chosen', async () => {
    // Arrange
    answering(() =>
      problemSaying(
        409,
        'Customer 00000000-0000-4000-8000-000000000000 cannot be deleted',
      ),
    )

    // Act
    const attempt = await removeCustomers(ids)

    // Assert
    expect(attempt).toEqual({ type: 'unfinished', id: undefined })
  })

  it.each<[string, () => Response | Promise<Response>, string]>([
    ['an account that may not', () => problem(403), 'forbidden'],
    ['a value the API refuses', () => problem(400), 'failed'],
    ['a body larger than the API takes', () => problem(413), 'failed'],
    ['a body the API does not take', () => problem(415), 'failed'],
    ...UNREAD,
  ])('should tell %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const attempt = await removeCustomers(ids)

    // Assert
    expect(attempt).toEqual({ type })
  })

  it('should fail when the API says somebody is gone and everybody is found', async () => {
    // Arrange
    answering((request) =>
      request.url.endsWith('/batch/get')
        ? readAnswer([hanako, ichiro])
        : problem(404),
    )

    // Act
    const attempt = await removeCustomers(ids)

    // Assert
    expect(attempt).toEqual({ type: 'failed' })
  })
})
