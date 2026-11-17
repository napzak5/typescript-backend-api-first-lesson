import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import {
  inventoryMovementRequestSchema,
  inventoryTransactionSearchRequestSchema,
} from '../schemas/inventory.schema'
import {
  INVENTORY_TRANSACTION_ID,
  inventoryMovementRequest,
} from './inventory-fixtures'

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

const movement = (overrides: Record<string, unknown> = {}) => ({
  ...inventoryMovementRequest(),
  ...overrides,
})

describe('inventoryMovementRequestSchema', () => {
  it('takes a request that satisfies every rule, and gives it back as it is', () => {
    expect(inventoryMovementRequestSchema.parse(movement())).toEqual(movement())
  })

  it.each([
    ['a purchase in', { transactionType: 'purchase', quantity: 0.01 }],
    ['a sale out', { transactionType: 'sale', quantity: -1 }],
    ['a use out', { transactionType: 'use', quantity: -0.25 }],
    [
      'a disposal out, with a reason',
      { transactionType: 'disposal', quantity: -2, reason: '破損' },
    ],
    [
      'an adjustment in, with a reason',
      { transactionType: 'adjustment', quantity: 1, reason: '棚卸の差異' },
    ],
    [
      'an adjustment out, with a reason',
      { transactionType: 'adjustment', quantity: -1, reason: '棚卸の差異' },
    ],
    ['a return in', { transactionType: 'return', quantity: 1 }],
    ['a return out', { transactionType: 'return', quantity: -1 }],
    ['a transfer in', { transactionType: 'transfer', quantity: 4 }],
    ['a transfer out', { transactionType: 'transfer', quantity: -4 }],
    ['the largest quantity in', { quantity: 99_999_999.99, unitCost: null }],
    [
      'the largest quantity out',
      { transactionType: 'sale', quantity: -99_999_999.99, unitCost: null },
    ],
    ['no cost', { unitCost: null }],
    ['a cost of nothing', { unitCost: 0 }],
    ['no reference', { referenceType: null, referenceId: null }],
    ['a kind of reference of 50 characters', { referenceType: 'r'.repeat(50) }],
    ['a reason on any kind', { reason: '定期の仕入れ' }],
    ['the largest total cost', { quantity: 1, unitCost: 2_147_483_647 }],
    [
      'the largest unit cost of a quantity, whose total is rounded down to the limit',
      { quantity: 3.07, unitCost: 699_506_074 },
    ],
  ])('takes %s', (_case, overrides) => {
    expect(
      brokenBy(inventoryMovementRequestSchema, movement(overrides)),
    ).toEqual([])
  })

  it.each([
    [
      'no movement',
      { transactionType: 'return', quantity: 0 },
      ['quantity:Must not be 0'],
    ],
    [
      'a purchase of nothing',
      { quantity: 0 },
      ['quantity:Must be above 0 for a purchase'],
    ],
    [
      'a purchase out',
      { quantity: -1 },
      ['quantity:Must be above 0 for a purchase'],
    ],
    [
      'a sale in',
      { transactionType: 'sale', quantity: 1 },
      ['quantity:Must be below 0 for a sale'],
    ],
    [
      'a use of nothing',
      { transactionType: 'use', quantity: 0 },
      ['quantity:Must be below 0 for a use'],
    ],
    [
      'a disposal in',
      { transactionType: 'disposal', quantity: 1, reason: '破損' },
      ['quantity:Must be below 0 for a disposal'],
    ],
    [
      'an adjustment without a reason',
      { transactionType: 'adjustment', quantity: 1, reason: null },
      ['reason:Must not be null: an adjustment and a disposal state why'],
    ],
    [
      'a disposal without a reason',
      { transactionType: 'disposal', quantity: -1, reason: null },
      ['reason:Must not be null: an adjustment and a disposal state why'],
    ],
    [
      'a kind of reference without an ID',
      { referenceId: null },
      ['referenceId:Must not be null when referenceType is given'],
    ],
    [
      'an ID of a reference without its kind',
      { referenceType: null },
      ['referenceType:Must not be null when referenceId is given'],
    ],
    [
      'a total cost above the limit',
      { quantity: 3.07, unitCost: 699_506_075 },
      [
        'unitCost:Must be at most 699506074: the total cost, unitCost × |quantity| rounded, has to be at most 2147483647',
      ],
    ],
    [
      'a total cost of a quantity out above the limit',
      { transactionType: 'sale', quantity: -2, unitCost: 1_073_741_824 },
      [
        'unitCost:Must be at most 1073741823: the total cost, unitCost × |quantity| rounded, has to be at most 2147483647',
      ],
    ],
  ])('refuses %s', (_case, overrides, messages) => {
    expect(
      messagesOf(inventoryMovementRequestSchema, movement(overrides)),
    ).toEqual(messages)
  })

  it.each([
    [
      'a quantity of three decimals',
      { quantity: 1.005 },
      ['quantity:not_multiple_of'],
    ],
    [
      'a quantity above the most',
      { quantity: 100_000_000 },
      ['quantity:too_big'],
    ],
    [
      'a quantity below the least',
      { transactionType: 'sale', quantity: -100_000_000 },
      ['quantity:too_small'],
    ],
    ['a quantity that is text', { quantity: '3' }, ['quantity:invalid_type']],
    [
      'a unit cost with a fraction',
      { unitCost: 1.5 },
      ['unitCost:invalid_type'],
    ],
    ['a negative unit cost', { unitCost: -1 }, ['unitCost:too_small']],
    [
      'a unit cost above an integer',
      { unitCost: 2_147_483_648 },
      ['unitCost:too_big'],
    ],
    [
      'an unknown kind',
      { transactionType: 'loss' },
      ['transactionType:invalid_value'],
    ],
    [
      'a stock row that is no UUID',
      { inventoryId: 'row-1' },
      ['inventoryId:invalid_format'],
    ],
    [
      'a reference ID that is no UUID',
      { referenceId: 'order-1' },
      ['referenceId:invalid_format'],
    ],
    [
      'a blank kind of reference',
      { referenceType: '  ' },
      ['referenceType:invalid_format'],
    ],
    [
      'a kind of reference of 51 characters',
      { referenceType: 'r'.repeat(51) },
      ['referenceType:too_big'],
    ],
    ['a blank reason', { reason: ' ' }, ['reason:invalid_format']],
    [
      'a property it does not know',
      { performedBy: null },
      [':unrecognized_keys'],
    ],
    [
      'the balance it moves from',
      { balanceBefore: 12.5 },
      [':unrecognized_keys'],
    ],
  ])('refuses %s', (_case, overrides, rules) => {
    expect(
      brokenBy(inventoryMovementRequestSchema, movement(overrides)),
    ).toEqual(rules)
  })

  it('refuses a request without one of its properties', () => {
    const { reason: _, ...withoutReason } = movement()

    expect(brokenBy(inventoryMovementRequestSchema, withoutReason)).toEqual([
      'reason:invalid_type',
    ])
  })

  it('does not look at the total cost again of a quantity or a unit cost that is wrong by itself', () => {
    expect(
      brokenBy(
        inventoryMovementRequestSchema,
        movement({ quantity: 100_000_000, unitCost: 2_147_483_647 }),
      ),
    ).toEqual(['quantity:too_big'])
    expect(
      brokenBy(
        inventoryMovementRequestSchema,
        movement({ quantity: 2.5, unitCost: 2_147_483_647.5 }),
      ),
    ).toEqual(['unitCost:invalid_type'])
  })

  it('tells every rule a request breaks at once', () => {
    expect(
      brokenBy(
        inventoryMovementRequestSchema,
        movement({
          transactionType: 'disposal',
          quantity: 3,
          reason: null,
          referenceId: null,
          unitCost: 2_147_483_647,
        }),
      ),
    ).toEqual([
      'unitCost:too_big',
      'quantity:custom',
      'reason:custom',
      'referenceId:custom',
    ])
  })
})

describe('inventoryTransactionSearchRequestSchema', () => {
  it('takes an empty query', () => {
    expect(inventoryTransactionSearchRequestSchema.parse({})).toEqual({})
  })

  it('takes every filter, and spells the moments as toISOString does', () => {
    expect(
      inventoryTransactionSearchRequestSchema.parse({
        limit: 100,
        cursor: INVENTORY_TRANSACTION_ID,
        transactionType: 'use',
        startDate: '2026-11-01T00:00:00.5Z',
        endDate: '2026-11-02T00:00:00Z',
      }),
    ).toEqual({
      limit: 100,
      cursor: INVENTORY_TRANSACTION_ID,
      transactionType: 'use',
      startDate: '2026-11-01T00:00:00.500Z',
      endDate: '2026-11-02T00:00:00.000Z',
    })
  })

  it.each([
    ['a limit of 0', { limit: 0 }, ['limit:too_small']],
    ['a limit of 101', { limit: 101 }, ['limit:too_big']],
    ['a cursor that is no UUID', { cursor: 'next' }, ['cursor:invalid_format']],
    [
      'an unknown kind',
      { transactionType: 'loss' },
      ['transactionType:invalid_value'],
    ],
    [
      'a start that is no moment',
      { startDate: '2026-11-01' },
      ['startDate:invalid_format'],
    ],
    [
      'an end before the start',
      {
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-10-31T23:59:59.999Z',
      },
      ['endDate:custom'],
    ],
    [
      'a property it does not know',
      { salonId: INVENTORY_TRANSACTION_ID },
      [':unrecognized_keys'],
    ],
  ])('refuses %s', (_case, query, rules) => {
    expect(brokenBy(inventoryTransactionSearchRequestSchema, query)).toEqual(
      rules,
    )
  })
})
