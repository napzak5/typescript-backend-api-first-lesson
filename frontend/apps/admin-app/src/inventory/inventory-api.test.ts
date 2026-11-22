import {
  answering,
  page,
  problem,
  UNREAD,
  UNWRITTEN,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { salon } from '../bookings/components/examples'
import { colour } from '../products/components/examples'
import { colourLot, STOCK_OF_THE_SALON } from './components/examples'
import {
  addStockRow,
  changeStockRow,
  everyStockRowKeyOf,
  mayKeepStock,
  readEveryStockRow,
  readStockPage,
  readStockRow,
  removeStockRow,
} from './inventory-api'
import type { StockView } from './stock-view'

/*
 * What the API answers to the stock is met with the real API
 * (`inventory.integration.test.tsx`). Here are the answers a test cannot
 * bring about there.
 */

type Answer = () => Response | Promise<Response>

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('mayKeepStock', () => {
  it.each<[string, boolean]>([
    ['owner', true],
    ['manager', true],
    ['admin', true],
    ['staff', false],
    ['customer', false],
  ])('should let %s keep the stock: %s', (role, keeps) => {
    expect(mayKeepStock(role)).toBe(keeps)
  })
})

describe('everyStockRowKeyOf', () => {
  it('should read every row below the stock of the salon, so that dropping the stock drops it', () => {
    expect(everyStockRowKeyOf(salon.id)).toEqual([
      'salons',
      salon.id,
      'inventory',
      'every',
    ])
  })
})

describe('readEveryStockRow', () => {
  it('should read the rows of the salon page by page, the largest pages, to the end', async () => {
    // Arrange
    const [first, ...rest] = STOCK_OF_THE_SALON
    const fetched = answering((request) =>
      new URL(request.url).searchParams.has('cursor')
        ? page(rest)
        : page(first === undefined ? [] : [first], first?.id ?? null),
    )

    // Act
    const read = await readEveryStockRow(salon.id)

    // Assert
    expect(read).toEqual({ type: 'found', items: STOCK_OF_THE_SALON })
    expect(
      fetched.mock.calls.map(([asked]) =>
        Object.fromEntries(new URL(new Request(asked).url).searchParams),
      ),
    ).toEqual([
      { salonId: salon.id, limit: '100' },
      { salonId: salon.id, cursor: first?.id, limit: '100' },
    ])
  })

  it.each<[string, Answer, string]>([
    ['the account', () => problem(403), 'forbidden'],
    ...UNREAD,
  ])('should read no rows after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readEveryStockRow(salon.id)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('readStockPage', () => {
  it.each<[string, StockView, string, Record<string, string>]>([
    [
      'every row of a lot of a product',
      { type: 'all', productId: colour.id, lotNumber: 'LOT-2026-041' },
      '/api/v1/inventory',
      {
        salonId: salon.id,
        productId: colour.id,
        lotNumber: 'LOT-2026-041',
        cursor: 'c5e7a9b1-3d4f-4a6b-8c0e-2f4a6c8e0b35',
        limit: '20',
      },
    ],
    [
      'the rows of the products whose stock is low',
      { type: 'lowStock' },
      '/api/v1/inventory/low-stock',
      {
        salonId: salon.id,
        cursor: 'c5e7a9b1-3d4f-4a6b-8c0e-2f4a6c8e0b35',
        limit: '20',
      },
    ],
    [
      'the rows that expire within a week',
      { type: 'expiring', days: 7 },
      '/api/v1/inventory/expiring',
      {
        salonId: salon.id,
        days: '7',
        cursor: 'c5e7a9b1-3d4f-4a6b-8c0e-2f4a6c8e0b35',
        limit: '20',
      },
    ],
  ])(
    'should ask for a page of %s, after the cursor',
    async (_, view, path, query) => {
      // Arrange
      const fetched = answering(() => page([colourLot]))

      // Act
      const read = await readStockPage(
        salon.id,
        view,
        'c5e7a9b1-3d4f-4a6b-8c0e-2f4a6c8e0b35',
      )

      // Assert
      expect(read).toEqual({
        type: 'found',
        items: [colourLot],
        total: 1,
        nextCursor: null,
      })
      expect(
        fetched.mock.calls.map(([asked]) => {
          const url = new URL(new Request(asked).url)

          return [url.pathname, Object.fromEntries(url.searchParams)]
        }),
      ).toEqual([[path, query]])
    },
  )

  it.each<[string, Answer, string]>([
    [
      'a cursor that names a row removed meanwhile',
      () => problem(400),
      'failed',
    ],
    ...UNREAD,
  ])('should read no page after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readStockPage(salon.id, { type: 'all' }, undefined)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('readStockRow', () => {
  it.each<[string, Answer, string]>([
    ['an address that names no row', () => problem(400), 'notFound'],
    ...UNREAD,
  ])('should read no row after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readStockRow('x')

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('addStockRow', () => {
  it.each<[string, Answer, string]>([
    [
      'the salon removed meanwhile',
      () => problem(400, [{ field: 'salonId', rule: 'not_found' }]),
      'notFound',
    ],
    ...UNWRITTEN,
  ])('should add no row after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const written = await addStockRow({
      salonId: salon.id,
      productId: colour.id,
      lotNumber: 'LOT-2026-050',
      expiryDate: null,
      location: null,
      shelf: null,
      notes: null,
    })

    // Assert
    expect(written).toEqual({ type })
  })
})

describe('changeStockRow', () => {
  it.each(UNWRITTEN)(
    'should change no row after %s',
    async (_, given, type) => {
      // Arrange
      answering(given)

      // Act
      const written = await changeStockRow(colourLot.id, { shelf: 'B-3' })

      // Assert
      expect(written).toEqual({ type })
    },
  )
})

describe('removeStockRow', () => {
  it.each<[string, Answer, string]>([
    ['an address that names no row', () => problem(400), 'notFound'],
    ...UNREAD,
  ])('should remove no row after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const removed = await removeStockRow('x')

    // Assert
    expect(removed).toEqual({ type })
  })
})
