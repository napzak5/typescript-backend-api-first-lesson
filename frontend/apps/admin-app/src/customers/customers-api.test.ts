import { afterEach, describe, expect, it, vi } from 'vitest'
import { answering, json, problem, UNREAD } from '../__tests__/api-answers'
import { aCustomer, customers } from '../bookings/components/examples'
import {
  customerKanaOf,
  customerNameOf,
  findCustomers,
  readCustomer,
  readCustomers,
} from './customers-api'

/*
 * That a customer who was removed makes the request of many customers
 * fall back to one request each is met with the real API
 * (`bookings.integration.test.tsx`). Here are the answers a test cannot
 * bring about there.
 */

const [hanako, ichiro] = customers

const ids = customers.map(({ id }) => id)

describe('readCustomers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should ask for each customer once', async () => {
    // Arrange
    const fetched = answering(() =>
      json(200, {
        data: customers,
        meta: null,
        links: { list: '/api/v1/customers' },
      }),
    )

    // Act
    const read = await readCustomers([...ids, ...ids])

    // Assert
    expect(read.type === 'found' && [...read.customers.keys()]).toEqual(ids)
    expect(fetched).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(fetched.mock.calls[0]?.[1]?.body))).toEqual({
      ids,
    })
  })

  it('should ask for nothing when there is nobody to read', async () => {
    // Arrange
    const fetched = answering(() => problem(500))

    // Act
    const read = await readCustomers([])

    // Assert
    expect(read.type === 'found' && read.customers.size).toBe(0)
    expect(fetched).not.toHaveBeenCalled()
  })

  it.each(UNREAD)(
    'should say why nothing came of %s',
    async (_case, answer, type) => {
      // Arrange
      answering(answer)

      // Act, Assert
      expect(await readCustomers(ids)).toEqual({ type })
    },
  )

  it.each([403, 413, 415])(
    'should fail on an answer that says nothing a person could act on (%i)',
    async (status) => {
      // Arrange
      answering(() => problem(status))

      // Act, Assert
      expect(await readCustomers(ids)).toEqual({ type: 'failed' })
    },
  )

  it('should say why nothing came of the requests one by one, after a customer was not found', async () => {
    // Arrange
    answering((request) =>
      request.method === 'POST'
        ? problem(404)
        : request.url.endsWith(hanako?.id ?? '')
          ? json(200, { data: hanako, meta: null, links: {} })
          : problem(429),
    )

    // Act, Assert
    expect(await readCustomers(ids)).toEqual({ type: 'tooManyRequests' })
  })

  it('should leave out who was not found, one by one', async () => {
    // Arrange
    answering((request) =>
      request.method === 'POST' || !request.url.endsWith(hanako?.id ?? '')
        ? problem(404)
        : json(200, { data: hanako, meta: null, links: {} }),
    )

    // Act
    const read = await readCustomers(ids)

    // Assert
    expect(read.type === 'found' && [...read.customers.keys()]).toEqual([
      hanako?.id,
    ])
  })
})

describe('readCustomer', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    ...UNREAD,
    ['a refusal of the account', () => problem(403), 'failed'],
  ])('should say why nothing came of %s', async (_case, answer, type) => {
    // Arrange
    answering(answer)

    // Act, Assert
    expect(await readCustomer(ichiro?.id ?? '')).toEqual({ type })
  })

  it('should not ask for what is no ID', async () => {
    // Arrange
    const fetched = answering(() => problem(500))

    // Act, Assert
    expect(await readCustomer('yamada')).toEqual({ type: 'notFound' })
    expect(fetched).not.toHaveBeenCalled()
  })
})

describe('findCustomers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should ask for the customers that have the keyword, 20 at a time, after the cursor', async () => {
    // Arrange
    const fetched = answering(() =>
      json(200, {
        data: customers,
        meta: { total: 42, nextCursor: ichiro?.id ?? null },
        links: { self: '/api/v1/customers' },
      }),
    )

    // Act
    const page = await findCustomers('山田', hanako?.id)

    // Assert
    expect(page).toEqual({
      type: 'found',
      items: customers,
      total: 42,
      nextCursor: ichiro?.id,
    })
    const asked = new URL(String(fetched.mock.calls[0]?.[0]))
    expect(asked.pathname).toBe('/api/v1/customers')
    expect(Object.fromEntries(asked.searchParams)).toEqual({
      search: '山田',
      cursor: hanako?.id,
      limit: '20',
    })
  })

  it.each([
    ...UNREAD,
    ['a refusal of the account', () => problem(403), 'failed'],
    ['a keyword the API does not take', () => problem(400), 'failed'],
  ])('should say why nothing came of %s', async (_case, answer, type) => {
    // Arrange
    answering(answer)

    // Act, Assert
    expect(await findCustomers('山田', undefined)).toEqual({ type })
  })
})

describe('customerKanaOf', () => {
  it.each([
    ['both names', aCustomer(), 'ヤマダ ハナコ'],
    ['the family name alone', aCustomer({ firstNameKana: null }), 'ヤマダ'],
    ['no name', aCustomer({ lastNameKana: null, firstNameKana: null }), ''],
  ])('should write the kana of %s', (_case, customer, kana) => {
    expect(customerKanaOf(customer)).toBe(kana)
  })
})

describe('customerNameOf', () => {
  it('should name a customer by the family name first', () => {
    expect(customerNameOf(aCustomer())).toBe('山田 花子')
  })
})
