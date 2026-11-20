import { afterEach, describe, expect, it, vi } from 'vitest'
import { answering, json, problem, UNREAD } from '../__tests__/api-answers'
import { aCustomer } from '../bookings/components/examples'
import { exportCustomerData, exportLedger } from './customer-export-api'
import type { CustomerConditions } from './customer-ledger'

/*
 * What the API answers to an export is met with the real API
 * (`customer-export.integration.test.tsx`). Here are the answers a test
 * cannot bring about there.
 */

const EVERYBODY: CustomerConditions = { tags: [] }

const CSV = 'id,lastName\r\n1,山田\r\n2,"佐藤\r\n（旧姓 鈴木）"\r\n'

/** A file the API answers with, named as it names it */
const fileAnswer = (
  body: string,
  type: string,
  name: string | undefined,
): Response =>
  new Response(body, {
    status: 200,
    headers: {
      'Content-Type': type,
      ...(name === undefined
        ? {}
        : { 'Content-Disposition': `attachment; filename=${name}` }),
    },
  })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('exportLedger', () => {
  it('should give the file the mark of its byte order back, and count its customers', async () => {
    // Arrange: the fetch function reads the text without the mark
    answering(() =>
      fileAnswer(
        `﻿${CSV}`,
        'text/csv; charset=utf-8',
        'customers-2026-11-20.csv',
      ),
    )

    // Act
    const exported = await exportLedger(EVERYBODY, 'Asia/Tokyo')

    // Assert: a line end in a quoted value ends no row
    expect(exported).toEqual({
      type: 'exported',
      file: {
        name: 'customers-2026-11-20.csv',
        type: 'text/csv; charset=utf-8',
        content: `﻿${CSV}`,
      },
      customers: 2,
    })
  })

  it('should count no customer in a file that names the columns alone', async () => {
    // Arrange
    answering(() =>
      fileAnswer(
        '﻿id,lastName\r\n',
        'text/csv; charset=utf-8',
        'customers-2026-11-20.csv',
      ),
    )

    // Act
    const exported = await exportLedger(EVERYBODY, 'Asia/Tokyo')

    // Assert
    expect(exported).toMatchObject({ type: 'exported', customers: 0 })
  })

  it('should ask for the customers of the conditions, the days as those of the salon', async () => {
    // Arrange
    const fetched = answering(() =>
      fileAnswer('id\r\n', 'text/csv; charset=utf-8', 'customers.csv'),
    )

    // Act
    await exportLedger(
      {
        search: '山田',
        tags: ['VIP', '紹介'],
        from: '2026-11-01',
        to: '2026-11-30',
        customerStatus: 'active',
        membershipTier: 'gold',
      },
      'Asia/Tokyo',
    )

    // Assert
    const [input] = fetched.mock.calls[0] ?? []
    const url = new URL(String(input))
    expect(url.pathname).toBe('/api/v1/customers/export')
    expect([...url.searchParams]).toEqual([
      ['search', '山田'],
      ['tags', 'VIP'],
      ['tags', '紹介'],
      ['registeredFrom', '2026-10-31T15:00:00.000Z'],
      ['registeredTo', '2026-11-30T14:59:59.999Z'],
      ['customerStatus', 'active'],
      ['membershipTier', 'gold'],
    ])
  })

  it.each<[string, () => Response]>([
    [
      'a file whose name the page may not read',
      () => fileAnswer(CSV, 'text/csv; charset=utf-8', undefined),
    ],
    [
      'a file with a quoted value that does not end',
      () =>
        fileAnswer('id,notes\r\n1,"メモ', 'text/csv; charset=utf-8', 'a.csv'),
    ],
    ['conditions the API does not take', () => problem(400)],
  ])('should save nothing of %s', async (_, answer) => {
    // Arrange
    answering(answer)

    // Act
    const exported = await exportLedger(EVERYBODY, 'Asia/Tokyo')

    // Assert
    expect(exported).toEqual({ type: 'failed' })
  })

  it.each<[number, string]>([
    [409, 'tooMany'],
    [403, 'forbidden'],
  ])('should take %i as %s', async (status, type) => {
    // Arrange
    answering(() => problem(status))

    // Act
    const exported = await exportLedger(EVERYBODY, 'Asia/Tokyo')

    // Assert
    expect(exported).toEqual({ type })
  })

  it.each(UNREAD)('should save nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const exported = await exportLedger(EVERYBODY, 'Asia/Tokyo')

    // Assert
    expect(exported).toEqual({ type })
  })
})

describe('exportCustomerData', () => {
  const customer = aCustomer()
  const DATA = {
    exportedAt: '2026-11-20T00:00:00.000Z',
    customer,
    bookings: [],
  }

  it('should write the file again as the API wrote it', async () => {
    // Arrange
    const text = JSON.stringify(DATA, null, 2)
    answering(() =>
      fileAnswer(
        text,
        'application/json; charset=utf-8',
        `customer-${customer.id}.json`,
      ),
    )

    // Act
    const exported = await exportCustomerData(customer.id)

    // Assert
    expect(exported).toEqual({
      type: 'exported',
      file: {
        name: `customer-${customer.id}.json`,
        type: 'application/json; charset=utf-8',
        content: text,
      },
    })
  })

  it('should save nothing of a file whose name the page may not read', async () => {
    // Arrange
    answering(() => json(200, DATA))

    // Act
    const exported = await exportCustomerData(customer.id)

    // Assert
    expect(exported).toEqual({ type: 'failed' })
  })

  it.each<[number, string]>([
    [404, 'notFound'],
    [403, 'forbidden'],
    [400, 'failed'],
  ])('should take %i as %s', async (status, type) => {
    // Arrange
    answering(() => problem(status))

    // Act
    const exported = await exportCustomerData(customer.id)

    // Assert
    expect(exported).toEqual({ type })
  })

  it.each(UNREAD)('should save nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const exported = await exportCustomerData(customer.id)

    // Assert
    expect(exported).toEqual({ type })
  })
})
