import { describe, expect, it } from 'vitest'
import { InventoryTransactionReadMapper } from '../mappers/read/inventory-transaction.mapper'
import { InventoryTransactionWriteMapper } from '../mappers/write/inventory-transaction.mapper'
import type { ApiInventoryMovementRequest } from '../models/inventory'
import { type StaffId, staffIdSchema } from '../models/staff'
import { inventoryMovementRequestSchema } from '../schemas/inventory.schema'
import { STAFF_ID } from './auth-fixtures'
import { SALON_ID } from './fixtures'
import {
  dbInventoryTransaction,
  INVENTORY_ID,
  INVENTORY_TRANSACTION_ID,
  inventoryMovementRequest,
  OTHER_INVENTORY_TRANSACTION_ID,
} from './inventory-fixtures'
import { PRODUCT_ID } from './product-fixtures'

describe('InventoryTransactionReadMapper', () => {
  it('names every column as it is, the quantity and the balances as numbers and the time in ISO 8601', () => {
    expect(
      InventoryTransactionReadMapper.toApiInventoryTransaction(
        dbInventoryTransaction(),
      ),
    ).toEqual({
      type: 'success',
      data: {
        id: INVENTORY_TRANSACTION_ID,
        salonId: SALON_ID,
        productId: PRODUCT_ID,
        inventoryId: INVENTORY_ID,
        transactionType: 'purchase',
        quantity: 3,
        balanceBefore: 12.5,
        balanceAfter: 15.5,
        unitCost: 1200,
        totalCost: 3600,
        referenceType: 'purchase_order',
        referenceId: OTHER_INVENTORY_TRANSACTION_ID,
        lotNumber: 'LOT-2026-001',
        expiryDate: '2027-03-31',
        reason: null,
        performedBy: STAFF_ID,
        createdAt: '2026-11-14T09:00:00.123Z',
      },
    })
  })

  it('keeps null for what is not set, a movement out as a negative quantity, and the largest figures', () => {
    const mapped = InventoryTransactionReadMapper.toApiInventoryTransaction(
      dbInventoryTransaction({
        inventoryId: null,
        transactionType: 'sale',
        quantity: '-99999999.99',
        balanceBefore: '99999999.99',
        balanceAfter: '0.00',
        unitCost: null,
        totalCost: null,
        referenceType: null,
        referenceId: null,
        lotNumber: null,
        expiryDate: null,
        performedBy: null,
      }),
    )

    expect(mapped).toMatchObject({
      type: 'success',
      data: {
        inventoryId: null,
        quantity: -99_999_999.99,
        balanceBefore: 99_999_999.99,
        balanceAfter: 0,
        unitCost: null,
        totalCost: null,
        referenceType: null,
        referenceId: null,
        lotNumber: null,
        expiryDate: null,
        performedBy: null,
      },
    })
  })

  it('shows no column it does not name', () => {
    const mapped = InventoryTransactionReadMapper.toApiInventoryTransaction({
      ...dbInventoryTransaction(),
      ...{ internalNote: 'x' },
    })

    expect(mapped).toEqual(
      InventoryTransactionReadMapper.toApiInventoryTransaction(
        dbInventoryTransaction(),
      ),
    )
  })

  it.each([
    ['a quantity that is not a number', { quantity: 'some' }],
    ['a balance before that is not a number', { balanceBefore: 'none' }],
    ['a balance after that is not a number', { balanceAfter: 'x' }],
    ['a time that is not a time', { createdAt: 'yesterday' }],
  ])('tells the database is wrong of %s', (_case, overrides) => {
    expect(
      InventoryTransactionReadMapper.toApiInventoryTransaction(
        dbInventoryTransaction(overrides),
      ),
    ).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `Stored stock movement ${INVENTORY_TRANSACTION_ID} does not match the API model`,
      },
    })
  })

  it('maps each movement of a list, and stops at the first it cannot', () => {
    expect(
      InventoryTransactionReadMapper.toApiInventoryTransactions([
        dbInventoryTransaction(),
        dbInventoryTransaction({ id: OTHER_INVENTORY_TRANSACTION_ID }),
      ]),
    ).toMatchObject({
      type: 'success',
      data: [
        { id: INVENTORY_TRANSACTION_ID },
        { id: OTHER_INVENTORY_TRANSACTION_ID },
      ],
    })
    expect(
      InventoryTransactionReadMapper.toApiInventoryTransactions([
        dbInventoryTransaction(),
        dbInventoryTransaction({
          id: OTHER_INVENTORY_TRANSACTION_ID,
          quantity: 'x',
        }),
      ]),
    ).toMatchObject({
      type: 'error',
      error: {
        message: `Stored stock movement ${OTHER_INVENTORY_TRANSACTION_ID} does not match the API model`,
      },
    })
  })
})

describe('InventoryTransactionWriteMapper', () => {
  const staffMember = staffIdSchema.parse(STAFF_ID)
  const write = (
    overrides: Partial<ApiInventoryMovementRequest> = {},
    performedBy: StaffId | null = staffMember,
  ) =>
    InventoryTransactionWriteMapper.fromMovementRequest(
      inventoryMovementRequestSchema.parse(inventoryMovementRequest(overrides)),
      performedBy,
    )

  it('writes what the request states, the quantity with two decimals, the total cost and the staff member', () => {
    expect(write()).toEqual({
      transactionType: 'purchase',
      quantity: '3.00',
      unitCost: 1200,
      totalCost: 3600,
      referenceType: 'purchase_order',
      referenceId: OTHER_INVENTORY_TRANSACTION_ID,
      reason: null,
      performedBy: STAFF_ID,
    })
  })

  it('writes no cost and no staff member where there are none', () => {
    expect(
      write(
        {
          transactionType: 'disposal',
          quantity: -0.5,
          unitCost: null,
          referenceType: null,
          referenceId: null,
          reason: '期限切れ',
        },
        null,
      ),
    ).toEqual({
      transactionType: 'disposal',
      quantity: '-0.50',
      unitCost: null,
      totalCost: null,
      referenceType: null,
      referenceId: null,
      reason: '期限切れ',
      performedBy: null,
    })
  })

  it.each<[number, number, string, number]>([
    [-3, 1200, '-3.00', 3600],
    [0.29, 3, '0.29', 1],
    [1.5, 1, '1.50', 2],
    [99_999_999.99, 21, '99999999.99', 2_100_000_000],
    [3.07, 699_506_074, '3.07', 2_147_483_647],
  ])(
    'writes a quantity of %d at %d yen as %s, costing %d',
    (quantity, unitCost, written, totalCost) => {
      expect(
        write({
          transactionType: 'adjustment',
          quantity,
          unitCost,
          reason: '棚卸',
        }),
      ).toMatchObject({ quantity: written, unitCost, totalCost })
    },
  )
})
