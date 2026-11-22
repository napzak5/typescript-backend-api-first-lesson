import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { SALON_ID } from '../../__tests__/fixtures/fixtures'
import {
  INVENTORY_ID,
  OTHER_INVENTORY_ID,
} from '../../__tests__/fixtures/inventory-fixtures'
import {
  inventoryStockCountRequestSchema,
  inventoryValueReportRequestSchema,
} from '../inventory.schema'

/** The rules a value breaks, as `path:code`; empty when it breaks none. */
const brokenBy = (schema: z.ZodType, value: unknown): string[] =>
  schema
    .safeParse(value)
    .error?.issues.map(({ path, code }) => `${path.join('.')}:${code}`) ?? []

/** What a value is told, as `path:message`. */
const messagesOf = (schema: z.ZodType, value: unknown): string[] =>
  schema
    .safeParse(value)
    .error?.issues.map(({ path, message }) => `${path.join('.')}:${message}`) ??
  []

const stockCount = (overrides: Record<string, unknown> = {}) => ({
  salonId: SALON_ID,
  items: [
    { inventoryId: INVENTORY_ID, countedQuantity: 10 },
    { inventoryId: OTHER_INVENTORY_ID, countedQuantity: 0 },
  ],
  reason: null,
  ...overrides,
})

/** The nth stock row of a count of many: IDs that differ in their last digits. */
const rowNumber = (n: number): string =>
  `0193a5b8-7c2e-7d4f-8a1b-${n.toString(16).padStart(12, '0')}`

describe('inventoryStockCountRequestSchema', () => {
  it('takes a count as it is, with the IDs in lower case', () => {
    expect(
      inventoryStockCountRequestSchema.parse(
        stockCount({
          salonId: SALON_ID.toUpperCase(),
          items: [
            {
              inventoryId: INVENTORY_ID.toUpperCase(),
              countedQuantity: 12.25,
            },
          ],
          reason: '月末の棚卸し',
        }),
      ),
    ).toEqual({
      salonId: SALON_ID,
      items: [{ inventoryId: INVENTORY_ID, countedQuantity: 12.25 }],
      reason: '月末の棚卸し',
    })
  })

  it('takes the most rows of a count, and the most stock of a row', () => {
    const items = Array.from({ length: 500 }, (_, n) => ({
      inventoryId: rowNumber(n),
      countedQuantity: 99_999_999.99,
    }))

    expect(
      brokenBy(inventoryStockCountRequestSchema, stockCount({ items })),
    ).toEqual([])
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['no rows', { items: [] }, ['items:too_small']],
    [
      'a row more than the most',
      {
        items: Array.from({ length: 501 }, (_, n) => ({
          inventoryId: rowNumber(n),
          countedQuantity: 1,
        })),
      },
      ['items:too_big'],
    ],
    [
      'a count below nothing',
      { items: [{ inventoryId: INVENTORY_ID, countedQuantity: -0.01 }] },
      ['items.0.countedQuantity:too_small'],
    ],
    [
      'a count above what a row holds',
      { items: [{ inventoryId: INVENTORY_ID, countedQuantity: 100_000_000 }] },
      ['items.0.countedQuantity:too_big'],
    ],
    [
      'a count of three decimals',
      { items: [{ inventoryId: INVENTORY_ID, countedQuantity: 1.005 }] },
      ['items.0.countedQuantity:not_multiple_of'],
    ],
    [
      'a count as text',
      { items: [{ inventoryId: INVENTORY_ID, countedQuantity: '10' }] },
      ['items.0.countedQuantity:invalid_type'],
    ],
    [
      'a row that is no UUID',
      { items: [{ inventoryId: 'shelf-1', countedQuantity: 10 }] },
      ['items.0.inventoryId:invalid_format'],
    ],
    [
      'a row without its count',
      { items: [{ inventoryId: INVENTORY_ID }] },
      ['items.0.countedQuantity:invalid_type'],
    ],
    [
      'a row with a property of no count',
      {
        items: [
          { inventoryId: INVENTORY_ID, countedQuantity: 1, lotNumber: 'A' },
        ],
      },
      ['items.0:unrecognized_keys'],
    ],
    [
      'a row counted twice',
      {
        items: [
          { inventoryId: INVENTORY_ID, countedQuantity: 1 },
          { inventoryId: OTHER_INVENTORY_ID, countedQuantity: 2 },
          { inventoryId: INVENTORY_ID, countedQuantity: 3 },
          { inventoryId: INVENTORY_ID, countedQuantity: 4 },
        ],
      },
      ['items.2.inventoryId:custom', 'items.3.inventoryId:custom'],
    ],
    [
      'a row counted again in capitals',
      {
        items: [
          { inventoryId: INVENTORY_ID, countedQuantity: 1 },
          { inventoryId: INVENTORY_ID.toUpperCase(), countedQuantity: 1 },
        ],
      },
      ['items.1.inventoryId:custom'],
    ],
    ['a blank reason', { reason: ' \t' }, ['reason:invalid_format']],
    [
      'a salon that is no UUID',
      { salonId: 'tokyo' },
      ['salonId:invalid_format'],
    ],
    ['a property of no count', { countedAt: null }, [':unrecognized_keys']],
  ])('refuses %s', (_case, overrides, broken) => {
    expect(
      brokenBy(inventoryStockCountRequestSchema, stockCount(overrides)),
    ).toEqual(broken)
  })

  it.each(['salonId', 'items', 'reason'])(
    'refuses a count without the key %s',
    (key) => {
      const count = Object.fromEntries(
        Object.entries(stockCount()).filter(([name]) => name !== key),
      )

      expect(brokenBy(inventoryStockCountRequestSchema, count)).toEqual([
        `${key}:invalid_type`,
      ])
    },
  )

  it('tells a row counted twice where it is counted again', () => {
    expect(
      messagesOf(
        inventoryStockCountRequestSchema,
        stockCount({
          items: [
            { inventoryId: INVENTORY_ID, countedQuantity: 1 },
            { inventoryId: INVENTORY_ID, countedQuantity: 1 },
          ],
        }),
      ),
    ).toEqual([
      'items.1.inventoryId:Must not repeat a stock row counted earlier',
    ])
  })
})

describe('inventoryValueReportRequestSchema', () => {
  it('takes a salon alone, and with a category', () => {
    expect(
      inventoryValueReportRequestSchema.parse({ salonId: SALON_ID }),
    ).toEqual({ salonId: SALON_ID })
    expect(
      inventoryValueReportRequestSchema.parse({
        salonId: SALON_ID,
        category: 'ヘアケア',
      }),
    ).toEqual({ salonId: SALON_ID, category: 'ヘアケア' })
  })

  it('takes a category of the most characters', () => {
    expect(
      brokenBy(inventoryValueReportRequestSchema, {
        salonId: SALON_ID,
        category: 'あ'.repeat(100),
      }),
    ).toEqual([])
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['no salon', {}, ['salonId:invalid_type']],
    ['two salons', { salonId: [SALON_ID, SALON_ID] }, ['salonId:invalid_type']],
    [
      'an empty category',
      { salonId: SALON_ID, category: '' },
      ['category:invalid_format'],
    ],
    [
      'a blank category',
      { salonId: SALON_ID, category: '  ' },
      ['category:invalid_format'],
    ],
    [
      'a category of a character too many',
      { salonId: SALON_ID, category: 'あ'.repeat(101) },
      ['category:too_big'],
    ],
    [
      'a parameter of no report',
      { salonId: SALON_ID, limit: '10' },
      [':unrecognized_keys'],
    ],
  ])('refuses %s', (_case, query, broken) => {
    expect(brokenBy(inventoryValueReportRequestSchema, query)).toEqual(broken)
  })
})
