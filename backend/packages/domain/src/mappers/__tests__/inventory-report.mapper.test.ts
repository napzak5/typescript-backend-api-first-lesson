import { describe, expect, it } from 'vitest'
import { STAFF_ID } from '../../__tests__/fixtures/auth-fixtures'
import { SALON_ID } from '../../__tests__/fixtures/fixtures'
import {
  countAdjustment,
  countDiscrepancy,
  dbInventoryTransaction,
  INVENTORY_ID,
  OTHER_INVENTORY_ID,
} from '../../__tests__/fixtures/inventory-fixtures'
import { staffIdSchema } from '../../models/staff'
import {
  inventoryStockCountRequestSchema,
  inventoryValueReportRequestSchema,
} from '../../schemas/inventory.schema'
import { InventoryReportReadMapper } from '../read/inventory-report.mapper'
import {
  InventoryReportWriteMapper,
  STOCK_COUNT_REASON,
} from '../write/inventory-report.mapper'

describe('InventoryReportWriteMapper.fromStockCountRequest', () => {
  const count = (reason: string | null) =>
    inventoryStockCountRequestSchema.parse({
      salonId: SALON_ID,
      items: [
        { inventoryId: INVENTORY_ID, countedQuantity: 10 },
        { inventoryId: OTHER_INVENTORY_ID, countedQuantity: 0.5 },
      ],
      reason,
    })

  it('writes what was counted as a quantity, in the order of the count, by the staff member', () => {
    expect(
      InventoryReportWriteMapper.fromStockCountRequest(
        count('月末の棚卸し'),
        staffIdSchema.parse(STAFF_ID),
      ),
    ).toEqual({
      salonId: SALON_ID,
      items: [
        { inventoryId: INVENTORY_ID, countedQuantity: '10.00' },
        { inventoryId: OTHER_INVENTORY_ID, countedQuantity: '0.50' },
      ],
      reason: '月末の棚卸し',
      performedBy: STAFF_ID,
    })
  })

  it("records a count without a reason as a count's, by no staff member", () => {
    expect(
      InventoryReportWriteMapper.fromStockCountRequest(count(null), null),
    ).toMatchObject({ reason: '棚卸しの差異', performedBy: null })
    expect(STOCK_COUNT_REASON).toBe('棚卸しの差異')
  })

  it('writes the most stock of a row to the cent', () => {
    const counted = inventoryStockCountRequestSchema.parse({
      salonId: SALON_ID,
      items: [{ inventoryId: INVENTORY_ID, countedQuantity: 99_999_999.99 }],
      reason: null,
    })

    expect(
      InventoryReportWriteMapper.fromStockCountRequest(counted, null).items,
    ).toEqual([{ inventoryId: INVENTORY_ID, countedQuantity: '99999999.99' }])
  })
})

describe('InventoryReportWriteMapper.fromValueReportRequest', () => {
  it('values the stock of the salon in every category when the request names none', () => {
    expect(
      InventoryReportWriteMapper.fromValueReportRequest(
        inventoryValueReportRequestSchema.parse({ salonId: SALON_ID }),
      ),
    ).toStrictEqual({ salonId: SALON_ID, category: null })
  })

  it('narrows the report to the category the request names', () => {
    expect(
      InventoryReportWriteMapper.fromValueReportRequest(
        inventoryValueReportRequestSchema.parse({
          salonId: SALON_ID,
          category: 'Hair Care',
        }),
      ),
    ).toStrictEqual({ salonId: SALON_ID, category: 'Hair Care' })
  })
})

describe('InventoryReportReadMapper.toApiStockCount', () => {
  it('returns the adjustments as movements and the figures of the rows that differed as numbers', () => {
    expect(
      InventoryReportReadMapper.toApiStockCount(
        [countAdjustment()],
        [countDiscrepancy()],
      ),
    ).toEqual({
      type: 'success',
      data: {
        adjustments: [
          expect.objectContaining({
            inventoryId: INVENTORY_ID,
            transactionType: 'adjustment',
            quantity: -2.5,
            balanceBefore: 12.5,
            balanceAfter: 10,
            reason: '棚卸しの差異',
          }),
        ],
        discrepancies: [
          {
            inventoryId: INVENTORY_ID,
            expected: 12.5,
            counted: 10,
            difference: -2.5,
          },
        ],
      },
    })
  })

  it('returns a count that found every row as it was as two empty lists', () => {
    expect(InventoryReportReadMapper.toApiStockCount([], [])).toEqual({
      type: 'success',
      data: { adjustments: [], discrepancies: [] },
    })
  })

  it('tells the database is wrong of a figure it cannot show', () => {
    const result = InventoryReportReadMapper.toApiStockCount(
      [],
      [
        {
          inventoryId: OTHER_INVENTORY_ID,
          expected: 'twelve',
          counted: '10.00',
          difference: '-2.00',
        },
      ],
    )

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `The count of stock row ${OTHER_INVENTORY_ID} does not match the API model`,
      },
    })
  })

  it('tells the database is wrong of an adjustment it cannot show', () => {
    expect(
      InventoryReportReadMapper.toApiStockCount(
        [dbInventoryTransaction({ quantity: 'some' })],
        [countDiscrepancy()],
      ),
    ).toMatchObject({ type: 'error', error: { type: 'database' } })
  })
})

describe('InventoryReportReadMapper.toApiValueReport', () => {
  it('returns the categories as they are and their sums as the totals', () => {
    expect(
      InventoryReportReadMapper.toApiValueReport(SALON_ID, [
        { category: 'ヘアケア', value: '15000', itemCount: 3 },
        { category: 'カラー剤', value: '8250', itemCount: 2 },
        { category: null, value: '0', itemCount: 1 },
      ]),
    ).toEqual({
      type: 'success',
      data: {
        totalValue: 23_250,
        totalItems: 6,
        categories: [
          { category: 'ヘアケア', value: 15_000, itemCount: 3 },
          { category: 'カラー剤', value: 8250, itemCount: 2 },
          { category: null, value: 0, itemCount: 1 },
        ],
      },
    })
  })

  it('returns a salon without stock as nothing', () => {
    expect(InventoryReportReadMapper.toApiValueReport(SALON_ID, [])).toEqual({
      type: 'success',
      data: { totalValue: 0, totalItems: 0, categories: [] },
    })
  })

  it('returns the most a number holds exactly, as a category and as the total', () => {
    expect(
      InventoryReportReadMapper.toApiValueReport(SALON_ID, [
        { category: 'ヘアケア', value: '9007199254740990', itemCount: 1 },
        { category: null, value: '1', itemCount: 1 },
      ]),
    ).toMatchObject({
      type: 'success',
      data: { totalValue: Number.MAX_SAFE_INTEGER },
    })
  })

  it('tells the database is wrong of a total more than a number holds exactly', () => {
    expect(
      InventoryReportReadMapper.toApiValueReport(SALON_ID, [
        { category: 'ヘアケア', value: '9007199254740991', itemCount: 1 },
        { category: null, value: '1', itemCount: 1 },
      ]),
    ).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `The value of the stock of salon ${SALON_ID} is more than a number holds exactly`,
      },
    })
  })

  it.each<[string, { value: string; itemCount: number }]>([
    [
      'a value more than a number holds exactly',
      { value: '9007199254740992', itemCount: 1 },
    ],
    ['a value of a fraction', { value: '15000.5', itemCount: 1 }],
    ['a value below nothing', { value: '-1', itemCount: 1 }],
    ['a category of no item', { value: '0', itemCount: 0 }],
  ])('tells the database is wrong of %s', (_case, figures) => {
    expect(
      InventoryReportReadMapper.toApiValueReport(SALON_ID, [
        { category: 'ヘアケア', ...figures },
      ]),
    ).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `The value of the stock of salon ${SALON_ID} does not match the API model`,
      },
    })
  })
})
