import { describe, expect, it } from 'vitest'
import { InventoryReadMapper } from '../mappers/read/inventory.mapper'
import { InventoryWriteMapper } from '../mappers/write/inventory.mapper'
import { STAFF_ID } from './auth-fixtures'
import { SALON_ID } from './fixtures'
import {
  dbInventory,
  INVENTORY_ID,
  inventoryCreateRequest,
  OTHER_INVENTORY_ID,
} from './inventory-fixtures'
import { PRODUCT_ID } from './product-fixtures'

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
      InventoryWriteMapper.fromCreateRequest(inventoryCreateRequest()),
    ).toEqual(inventoryCreateRequest())
  })

  it('makes changes of only what an update request names, null included', () => {
    expect(
      InventoryWriteMapper.fromUpdateRequest({ shelf: 'B-2', notes: null }),
    ).toEqual({ shelf: 'B-2', notes: null })
  })
})
