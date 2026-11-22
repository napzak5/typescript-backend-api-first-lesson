import { describe, expect, it } from 'vitest'
import { STAFF_ID } from '../../__tests__/fixtures/auth-fixtures'
import { OTHER_SALON_ID, SALON_ID } from '../../__tests__/fixtures/fixtures'
import {
  dbInventory,
  INVENTORY_ID,
  inventoryCreateRequest,
  OTHER_INVENTORY_ID,
} from '../../__tests__/fixtures/inventory-fixtures'
import { PRODUCT_ID } from '../../__tests__/fixtures/product-fixtures'
import type { LedgerReach } from '../../models/booking'
import { inventoryIdSchema } from '../../models/inventory'
import { salonIdSchema } from '../../models/salon'
import {
  inventoryCreateRequestSchema,
  inventoryExpiringSearchRequestSchema,
  inventoryLowStockSearchRequestSchema,
  inventorySearchRequestSchema,
} from '../../schemas/inventory.schema'
import { InventoryReadMapper } from '../read/inventory.mapper'
import { InventoryWriteMapper } from '../write/inventory.mapper'

describe('InventoryReadMapper', () => {
  it('names every column as it is, the stock figures as numbers and the times in ISO 8601', () => {
    expect(InventoryReadMapper.toApiInventory(dbInventory())).toEqual({
      type: 'success',
      data: {
        id: INVENTORY_ID,
        salonId: SALON_ID,
        productId: PRODUCT_ID,
        currentStock: 12.5,
        availableStock: 10.5,
        reservedStock: 2,
        lotNumber: 'LOT-2026-001',
        expiryDate: '2027-03-31',
        location: '倉庫 A',
        shelf: null,
        lastCountedAt: '2026-11-10T09:00:00.000Z',
        lastCountedBy: STAFF_ID,
        notes: null,
        createdAt: '2026-11-14T09:00:00.123Z',
        updatedAt: '2026-11-14T09:30:00.000Z',
      },
    })
  })

  it('keeps null for what is not set, and the largest figures a row holds', () => {
    const mapped = InventoryReadMapper.toApiInventory(
      dbInventory({
        currentStock: '99999999.99',
        availableStock: '99999999.99',
        reservedStock: '0.00',
        lotNumber: null,
        expiryDate: null,
        location: null,
        lastCountedAt: null,
        lastCountedBy: null,
      }),
    )

    expect(mapped).toMatchObject({
      type: 'success',
      data: {
        currentStock: 99_999_999.99,
        availableStock: 99_999_999.99,
        reservedStock: 0,
        lotNumber: null,
        expiryDate: null,
        location: null,
        lastCountedAt: null,
        lastCountedBy: null,
      },
    })
  })

  it('shows no column it does not name', () => {
    const mapped = InventoryReadMapper.toApiInventory({
      ...dbInventory(),
      ...{ deletedAt: null, internalNote: 'x' },
    })

    expect(mapped).toEqual(InventoryReadMapper.toApiInventory(dbInventory()))
  })

  it.each([
    ['a stock figure that is not a number', { currentStock: 'many' }],
    ['a time that is not a time', { createdAt: 'yesterday' }],
    ['a count time that is not a time', { lastCountedAt: 'never' }],
  ])(
    'resolves a stored row with %s to a database error that names the row',
    (_case, overrides) => {
      expect(
        InventoryReadMapper.toApiInventory(dbInventory(overrides)),
      ).toMatchObject({
        type: 'error',
        error: {
          type: 'database',
          message: `Stored stock row ${INVENTORY_ID} does not match the API model`,
        },
      })
    },
  )

  it('maps every row of a list in order, and fails the list on the first row it cannot map', () => {
    const rows = [dbInventory(), dbInventory({ id: OTHER_INVENTORY_ID })]

    const mapped = InventoryReadMapper.toApiInventories(rows)
    const failed = InventoryReadMapper.toApiInventories([
      ...rows,
      dbInventory({ id: OTHER_INVENTORY_ID, updatedAt: 'later' }),
    ])

    expect(
      mapped.type === 'success' && mapped.data.map(({ id }) => id),
    ).toEqual([INVENTORY_ID, OTHER_INVENTORY_ID])
    expect(failed).toMatchObject({
      type: 'error',
      error: { message: expect.stringContaining(OTHER_INVENTORY_ID) },
    })
  })
})

describe('InventoryWriteMapper', () => {
  it('turns a create request into the row it names, with nothing about stock', () => {
    expect(
      InventoryWriteMapper.fromCreateRequest(
        inventoryCreateRequestSchema.parse(inventoryCreateRequest()),
      ),
    ).toStrictEqual(inventoryCreateRequest())
  })

  it('makes changes of only what an update request names, null included', () => {
    expect(
      InventoryWriteMapper.fromUpdateRequest({ shelf: 'B-2', notes: null }),
    ).toEqual({ shelf: 'B-2', notes: null })
  })
})

describe('InventoryReadMapper.toApiInventoryPage', () => {
  const paging = { limit: 2, after: inventoryIdSchema.parse(INVENTORY_ID) }

  it('answers with the rows, the counts of the list and the place of the page', () => {
    expect(
      InventoryReadMapper.toApiInventoryPage(
        {
          rows: [dbInventory({ id: OTHER_INVENTORY_ID }), dbInventory()],
          total: 5,
          hasMore: true,
        },
        paging,
      ),
    ).toMatchObject({
      type: 'success',
      data: {
        data: [{ id: OTHER_INVENTORY_ID }, { id: INVENTORY_ID }],
        meta: {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: INVENTORY_ID,
          nextCursor: INVENTORY_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('names no next page when the list ends with this one', () => {
    expect(
      InventoryReadMapper.toApiInventoryPage(
        { rows: [dbInventory()], total: 1, hasMore: false },
        { limit: 20, after: null },
      ),
    ).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 1,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
        },
      },
    })
  })

  it('fails on the first row that does not match the API model', () => {
    expect(
      InventoryReadMapper.toApiInventoryPage(
        {
          rows: [
            dbInventory(),
            dbInventory({ id: OTHER_INVENTORY_ID, updatedAt: 'later' }),
          ],
          total: 2,
          hasMore: false,
        },
        paging,
      ),
    ).toMatchObject({
      type: 'error',
      error: { message: expect.stringContaining(OTHER_INVENTORY_ID) },
    })
  })
})

describe('InventoryWriteMapper.fromSearchRequest', () => {
  const everySalon: LedgerReach = { type: 'everySalon' }
  const unfiltered = { salonId: null, productId: null, lotNumber: null }

  it('lists the first 20 rows within the reach when the request names nothing', () => {
    expect(
      InventoryWriteMapper.fromSearchRequest(
        inventorySearchRequestSchema.parse({}),
        everySalon,
      ),
    ).toStrictEqual({
      reach: everySalon,
      limit: 20,
      after: null,
      ...unfiltered,
    })
  })

  it('takes the reach it is given, the place of the page and every filter the request names', () => {
    const ownSalon: LedgerReach = {
      type: 'salon',
      salonId: salonIdSchema.parse(OTHER_SALON_ID),
    }

    expect(
      InventoryWriteMapper.fromSearchRequest(
        inventorySearchRequestSchema.parse({
          limit: 5,
          cursor: INVENTORY_ID,
          salonId: SALON_ID,
          productId: PRODUCT_ID,
          lotNumber: 'LOT-2026-001',
        }),
        ownSalon,
      ),
    ).toStrictEqual({
      reach: ownSalon,
      limit: 5,
      after: INVENTORY_ID,
      salonId: SALON_ID,
      productId: PRODUCT_ID,
      lotNumber: 'LOT-2026-001',
    })
  })

  it.each<[string, Record<string, string>]>([
    ['the salon', { salonId: SALON_ID }],
    ['the product', { productId: PRODUCT_ID }],
    ['the lot number', { lotNumber: 'LOT-2026-001' }],
  ])('narrows the list by %s alone', (_named, filter) => {
    expect(
      InventoryWriteMapper.fromSearchRequest(
        inventorySearchRequestSchema.parse(filter),
        everySalon,
      ),
    ).toStrictEqual({
      reach: everySalon,
      limit: 20,
      after: null,
      ...unfiltered,
      ...filter,
    })
  })
})

describe('InventoryWriteMapper.fromLowStockSearchRequest', () => {
  it('lists the first 20 rows of the salon by the levels of their products when the request names no threshold', () => {
    expect(
      InventoryWriteMapper.fromLowStockSearchRequest(
        inventoryLowStockSearchRequestSchema.parse({ salonId: SALON_ID }),
      ),
    ).toStrictEqual({
      salonId: SALON_ID,
      limit: 20,
      after: null,
      threshold: null,
    })
  })

  it('takes the place of the page and the threshold the request names, one of 0 too', () => {
    expect(
      InventoryWriteMapper.fromLowStockSearchRequest(
        inventoryLowStockSearchRequestSchema.parse({
          salonId: SALON_ID,
          limit: 5,
          cursor: INVENTORY_ID,
          threshold: 0,
        }),
      ),
    ).toStrictEqual({
      salonId: SALON_ID,
      limit: 5,
      after: INVENTORY_ID,
      threshold: 0,
    })
  })
})

describe('InventoryWriteMapper.fromExpiringSearchRequest', () => {
  it('counts 30 days from today as soon when the request names no days', () => {
    expect(
      InventoryWriteMapper.fromExpiringSearchRequest(
        inventoryExpiringSearchRequestSchema.parse({ salonId: SALON_ID }),
      ),
    ).toStrictEqual({ salonId: SALON_ID, limit: 20, after: null, days: 30 })
  })

  it('takes the place of the page and the days the request names, today alone too', () => {
    expect(
      InventoryWriteMapper.fromExpiringSearchRequest(
        inventoryExpiringSearchRequestSchema.parse({
          salonId: SALON_ID,
          limit: 5,
          cursor: INVENTORY_ID,
          days: 0,
        }),
      ),
    ).toStrictEqual({
      salonId: SALON_ID,
      limit: 5,
      after: INVENTORY_ID,
      days: 0,
    })
  })
})
