import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { SALON_ID } from '../../__tests__/fixtures/fixtures'
import {
  INVENTORY_ID,
  OTHER_INVENTORY_ID,
} from '../../__tests__/fixtures/inventory-fixtures'
import { PRODUCT_ID } from '../../__tests__/fixtures/product-fixtures'
import { purchaseOrderCreateRequest } from '../../__tests__/fixtures/purchase-order-fixtures'
import {
  purchaseOrderCancelRequestSchema,
  purchaseOrderCreateRequestSchema,
  purchaseOrderReceiveRequestSchema,
  purchaseOrderSearchRequestSchema,
  purchaseOrderUpdateRequestSchema,
  reorderSuggestionSearchRequestSchema,
} from '../purchase-order.schema'

/** The rules a value breaks, as `path:code`; empty when it breaks none. */
const brokenBy = (schema: z.ZodType, value: unknown): string[] =>
  schema
    .safeParse(value)
    .error?.issues.map(({ path, code }) => `${path.join('.')}:${code}`) ?? []

/** The messages of the rules a value breaks. */
const messagesOf = (schema: z.ZodType, value: unknown): string[] =>
  schema.safeParse(value).error?.issues.map(({ message }) => message) ?? []

const MAX_INTEGER = 2_147_483_647

/** An order of one item, with neither tax nor shipping. */
const orderOf = (
  item: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
) =>
  purchaseOrderCreateRequest({
    items: [
      {
        inventoryId: INVENTORY_ID,
        quantity: 1,
        unitPrice: 0,
        notes: null,
        ...item,
      },
    ],
    taxAmount: 0,
    shippingCost: null,
    ...overrides,
  })

describe('purchaseOrderCreateRequestSchema', () => {
  it('takes a request that names everything, and gives it back as it is', () => {
    expect(
      purchaseOrderCreateRequestSchema.parse(purchaseOrderCreateRequest()),
    ).toEqual(purchaseOrderCreateRequest())
  })

  it('takes null for the shipping, the delivery date, the terms and the notes', () => {
    const request = purchaseOrderCreateRequest({
      shippingCost: null,
      expectedDelivery: null,
      paymentTerms: null,
      notes: null,
    })

    expect(brokenBy(purchaseOrderCreateRequestSchema, request)).toEqual([])
  })

  it.each<[string, Record<string, unknown>]>([
    ['a supplier of 255 characters', { supplier: '仕'.repeat(255) }],
    ['no tax and no shipping', { taxAmount: 0, shippingCost: 0 }],
    ['terms of any length', { paymentTerms: '条件'.repeat(5_000) }],
  ])('takes %s', (_case, overrides) => {
    expect(
      brokenBy(
        purchaseOrderCreateRequestSchema,
        purchaseOrderCreateRequest(overrides),
      ),
    ).toEqual([])
  })

  it('takes 100 items, each of its own stock row', () => {
    const items = Array.from({ length: 100 }, (_, index) => ({
      inventoryId: `0193a5b8-7c2e-7d4f-8a1b-${String(index).padStart(12, '0')}`,
      quantity: 1,
      unitPrice: 100,
      notes: null,
    }))

    expect(
      brokenBy(
        purchaseOrderCreateRequestSchema,
        purchaseOrderCreateRequest({ items }),
      ),
    ).toEqual([])
  })

  it.each<[string, Record<string, unknown>]>([
    ['the least quantity', { quantity: 0.01 }],
    ['the most quantity', { quantity: 99_999_999.99 }],
    ['a quantity in hundredths', { quantity: 0.07 }],
    ['a unit price of nothing', { unitPrice: 0 }],
    ['notes of an item', { notes: '至急' }],
  ])('takes an item of %s', (_case, item) => {
    expect(brokenBy(purchaseOrderCreateRequestSchema, orderOf(item))).toEqual(
      [],
    )
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['no salon', { salonId: null }, ['salonId:invalid_type']],
    [
      'a salon ID that is no UUID',
      { salonId: 'salon-1' },
      ['salonId:invalid_format'],
    ],
    ['a blank supplier', { supplier: '   ' }, ['supplier:invalid_format']],
    [
      'a supplier of 256 characters',
      { supplier: '仕'.repeat(256) },
      ['supplier:too_big'],
    ],
    ['no items', { items: [] }, ['items:too_small']],
    ['a tax below zero', { taxAmount: -1 }, ['taxAmount:too_small']],
    [
      'a tax in fractions of a yen',
      { taxAmount: 0.5 },
      ['taxAmount:invalid_type'],
    ],
    [
      'a tax above an integer',
      { taxAmount: MAX_INTEGER + 1 },
      ['taxAmount:too_big'],
    ],
    ['shipping below zero', { shippingCost: -1 }, ['shippingCost:too_small']],
    [
      'an expected delivery that is no moment',
      { expectedDelivery: '2026-11-21' },
      ['expectedDelivery:invalid_format'],
    ],
    [
      'an expected delivery with an offset',
      { expectedDelivery: '2026-11-21T10:00:00+09:00' },
      ['expectedDelivery:invalid_format'],
    ],
    [
      'an expected delivery before 1900',
      { expectedDelivery: '1899-12-31T00:00:00Z' },
      ['expectedDelivery:too_small'],
    ],
    ['blank terms', { paymentTerms: '' }, ['paymentTerms:invalid_format']],
    ['blank notes', { notes: ' ' }, ['notes:invalid_format']],
    [
      'what the server states of an order',
      { orderNumber: 'PO-0000-0000' },
      [':unrecognized_keys'],
    ],
    ['a status', { status: 'approved' }, [':unrecognized_keys']],
    ['the delivery notes', { deliveryNotes: '午前着' }, [':unrecognized_keys']],
  ])('refuses %s', (_case, overrides, expected) => {
    expect(
      brokenBy(
        purchaseOrderCreateRequestSchema,
        purchaseOrderCreateRequest(overrides),
      ),
    ).toEqual(expected)
  })

  it('refuses 101 items', () => {
    const items = Array.from({ length: 101 }, (_, index) => ({
      inventoryId: `0193a5b8-7c2e-7d4f-8a1b-${String(index).padStart(12, '0')}`,
      quantity: 1,
      unitPrice: 100,
      notes: null,
    }))

    expect(
      brokenBy(
        purchaseOrderCreateRequestSchema,
        purchaseOrderCreateRequest({ items }),
      ),
    ).toEqual(['items:too_big'])
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    [
      'no stock row',
      { inventoryId: null },
      ['items.0.inventoryId:invalid_type'],
    ],
    ['no quantity', { quantity: 0 }, ['items.0.quantity:too_small']],
    ['a quantity below zero', { quantity: -1 }, ['items.0.quantity:too_small']],
    [
      'a quantity above a row',
      { quantity: 100_000_000 },
      ['items.0.quantity:too_big'],
    ],
    [
      'a quantity in thousandths',
      { quantity: 1.005 },
      ['items.0.quantity:not_multiple_of'],
    ],
    [
      'a unit price below zero',
      { unitPrice: -1 },
      ['items.0.unitPrice:too_small'],
    ],
    [
      'a unit price in fractions of a yen',
      { unitPrice: 1.5 },
      ['items.0.unitPrice:invalid_type'],
    ],
    ['blank notes', { notes: '' }, ['items.0.notes:invalid_format']],
    [
      'what the server copies of the product',
      { productName: 'シャンプー' },
      ['items.0:unrecognized_keys'],
    ],
    ['a total', { totalPrice: 1500 }, ['items.0:unrecognized_keys']],
  ])('refuses an item of %s', (_case, item, expected) => {
    expect(brokenBy(purchaseOrderCreateRequestSchema, orderOf(item))).toEqual(
      expected,
    )
  })

  it('refuses a stock row named again, where it is named again, in any letters', () => {
    const request = purchaseOrderCreateRequest({
      items: [
        { inventoryId: INVENTORY_ID, quantity: 1, unitPrice: 1, notes: null },
        {
          inventoryId: OTHER_INVENTORY_ID,
          quantity: 1,
          unitPrice: 1,
          notes: null,
        },
        {
          inventoryId: INVENTORY_ID.toUpperCase(),
          quantity: 2,
          unitPrice: 1,
          notes: null,
        },
      ],
    })

    expect(brokenBy(purchaseOrderCreateRequestSchema, request)).toEqual([
      'items.2.inventoryId:custom',
    ])
  })

  it('reports a stock row named again and an item that comes to more than an integer, both', () => {
    const request = purchaseOrderCreateRequest({
      items: [
        {
          inventoryId: INVENTORY_ID,
          quantity: 3,
          unitPrice: 715_827_883,
          notes: null,
        },
        {
          inventoryId: OTHER_INVENTORY_ID,
          quantity: 1,
          unitPrice: 1,
          notes: null,
        },
        { inventoryId: INVENTORY_ID, quantity: 1, unitPrice: 1, notes: null },
      ],
    })

    expect(brokenBy(purchaseOrderCreateRequestSchema, request)).toEqual([
      'items.2.inventoryId:custom',
      'items.0.unitPrice:too_big',
    ])
  })

  it('takes an item that comes to an integer, and rounds what it comes to half up', () => {
    expect(
      brokenBy(
        purchaseOrderCreateRequestSchema,
        orderOf({ quantity: 3, unitPrice: 715_827_882 }),
      ),
    ).toEqual([])
    // 1.5 × 1431655765 = 2147483647.5, which rounds up past an integer.
    expect(
      brokenBy(
        purchaseOrderCreateRequestSchema,
        orderOf({ quantity: 1.5, unitPrice: 1_431_655_765 }),
      ),
    ).toEqual(['items.0.unitPrice:too_big'])
  })

  it('refuses an item that comes to more than an integer holds, at its unit price, saying the most it may be', () => {
    const request = orderOf({ quantity: 3, unitPrice: 715_827_883 })

    expect(brokenBy(purchaseOrderCreateRequestSchema, request)).toEqual([
      'items.0.unitPrice:too_big',
    ])
    expect(messagesOf(purchaseOrderCreateRequestSchema, request)).toEqual([
      `Must be at most 715827882: the total of the item, quantity × unitPrice rounded, has to be at most ${MAX_INTEGER}`,
    ])
  })

  it('takes the most quantity at the unit price that keeps the item within an integer, and refuses a yen more', () => {
    // 99999999.99 × 21 = 2099999999.79; × 22 = 2199999999.78.
    expect(
      brokenBy(
        purchaseOrderCreateRequestSchema,
        orderOf({ quantity: 99_999_999.99, unitPrice: 21 }),
      ),
    ).toEqual([])
    expect(
      brokenBy(
        purchaseOrderCreateRequestSchema,
        orderOf({ quantity: 99_999_999.99, unitPrice: 22 }),
      ),
    ).toEqual(['items.0.unitPrice:too_big'])
  })

  it('does not look at the total of an item whose quantity or unit price is wrong by itself', () => {
    expect(
      brokenBy(
        purchaseOrderCreateRequestSchema,
        orderOf({ quantity: 100_000_000, unitPrice: MAX_INTEGER }),
      ),
    ).toEqual(['items.0.quantity:too_big'])
    expect(
      brokenBy(
        purchaseOrderCreateRequestSchema,
        orderOf({ quantity: 2, unitPrice: MAX_INTEGER + 1 }),
      ),
    ).toEqual(['items.0.unitPrice:too_big'])
  })

  it('refuses items that come to more than an integer holds together, on the items', () => {
    const half = { quantity: 1, unitPrice: 1_073_741_824, notes: null }
    const request = purchaseOrderCreateRequest({
      items: [
        { inventoryId: INVENTORY_ID, ...half },
        { inventoryId: OTHER_INVENTORY_ID, ...half },
      ],
      taxAmount: 0,
      shippingCost: null,
    })

    expect(brokenBy(purchaseOrderCreateRequestSchema, request)).toEqual([
      'items:custom',
    ])
    expect(messagesOf(purchaseOrderCreateRequestSchema, request)).toEqual([
      `The amounts of a purchase order must not exceed ${MAX_INTEGER}: the subtotal, what the items come to, and the total, the subtotal with the tax and the shipping cost`,
    ])
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['the tax', { taxAmount: 1, shippingCost: null }, ['items:custom']],
    ['the shipping', { taxAmount: 0, shippingCost: 1 }, ['items:custom']],
    ['neither', { taxAmount: 0, shippingCost: null }, []],
  ])(
    'refuses a total above an integer by %s, an item at the most',
    (_case, overrides, expected) => {
      expect(
        brokenBy(
          purchaseOrderCreateRequestSchema,
          orderOf({ unitPrice: MAX_INTEGER }, overrides),
        ),
      ).toEqual(expected)
    },
  )

  it('does not add up the amounts of a request that is wrong otherwise', () => {
    expect(
      brokenBy(
        purchaseOrderCreateRequestSchema,
        orderOf({ unitPrice: MAX_INTEGER }, { taxAmount: 1, supplier: ' ' }),
      ),
    ).toEqual(['supplier:invalid_format'])
  })
})

describe('purchaseOrderUpdateRequestSchema', () => {
  it.each<[string, Record<string, unknown>]>([
    ['a status', { status: 'pending' }],
    ['any status', { status: 'delivered' }],
    ['an expected delivery', { expectedDelivery: '2026-11-25T00:00:00Z' }],
    ['no expected delivery', { expectedDelivery: null }],
    ['delivery notes', { deliveryNotes: '午前着' }],
    ['no notes', { notes: null }],
  ])('takes %s', (_case, request) => {
    expect(brokenBy(purchaseOrderUpdateRequestSchema, request)).toEqual([])
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['nothing', {}, [':custom']],
    ['a status that is not one', { status: 'lost' }, ['status:invalid_value']],
    ['a status of null', { status: null }, ['status:invalid_value']],
    [
      'blank delivery notes',
      { deliveryNotes: ' ' },
      ['deliveryNotes:invalid_format'],
    ],
    [
      'the delivery',
      { actualDelivery: '2026-11-21T00:00:00Z' },
      [':unrecognized_keys'],
    ],
    ['the supplier', { supplier: '別の仕入先' }, [':unrecognized_keys']],
    ['the items', { items: [] }, [':unrecognized_keys']],
  ])('refuses %s', (_case, request, expected) => {
    expect(brokenBy(purchaseOrderUpdateRequestSchema, request)).toEqual(
      expected,
    )
  })
})

describe('purchaseOrderCancelRequestSchema', () => {
  it('takes a reason', () => {
    expect(
      brokenBy(purchaseOrderCancelRequestSchema, {
        cancellationReason: '仕入先の在庫切れ',
      }),
    ).toEqual([])
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['no reason', {}, ['cancellationReason:invalid_type']],
    [
      'a blank reason',
      { cancellationReason: '  ' },
      ['cancellationReason:invalid_format'],
    ],
    [
      'a reason of null',
      { cancellationReason: null },
      ['cancellationReason:invalid_type'],
    ],
    [
      'the reason by its old name',
      { reason: '在庫切れ', cancellationReason: '在庫切れ' },
      [':unrecognized_keys'],
    ],
  ])('refuses %s', (_case, request, expected) => {
    expect(brokenBy(purchaseOrderCancelRequestSchema, request)).toEqual(
      expected,
    )
  })
})

describe('purchaseOrderSearchRequestSchema', () => {
  it('takes every filter, and gives the moments back to the millisecond', () => {
    expect(
      purchaseOrderSearchRequestSchema.parse({
        limit: 100,
        status: 'pending',
        supplier: 'Beauty Supply Tokyo',
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-11-01T00:00:00Z',
      }),
    ).toEqual({
      limit: 100,
      status: 'pending',
      supplier: 'Beauty Supply Tokyo',
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-01T00:00:00.000Z',
    })
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['no limit', { limit: 0 }, ['limit:too_small']],
    ['a limit above a page', { limit: 101 }, ['limit:too_big']],
    ['a cursor that is no ID', { cursor: 'next' }, ['cursor:invalid_format']],
    ['a status that is not one', { status: 'lost' }, ['status:invalid_value']],
    ['a blank supplier', { supplier: ' ' }, ['supplier:invalid_format']],
    [
      'a supplier of 256 characters',
      { supplier: 's'.repeat(256) },
      ['supplier:too_big'],
    ],
    [
      'an end before the start',
      {
        startDate: '2026-11-02T00:00:00Z',
        endDate: '2026-11-01T23:59:59.999Z',
      },
      ['endDate:custom'],
    ],
    ['a filter it does not know', { productId: 'x' }, [':unrecognized_keys']],
  ])('refuses %s', (_case, query, expected) => {
    expect(brokenBy(purchaseOrderSearchRequestSchema, query)).toEqual(expected)
  })
})

describe('purchaseOrderReceiveRequestSchema', () => {
  const receipt = (overrides: Record<string, unknown> = {}) => ({
    items: [
      { inventoryId: INVENTORY_ID, quantity: 10 },
      { inventoryId: OTHER_INVENTORY_ID, quantity: 1.25 },
    ],
    deliveryNotes: '段ボール 2 箱',
    ...overrides,
  })

  it('takes the items and the notes, and gives them back as they are', () => {
    expect(purchaseOrderReceiveRequestSchema.parse(receipt())).toEqual(
      receipt(),
    )
    expect(
      purchaseOrderReceiveRequestSchema.parse(receipt({ deliveryNotes: null })),
    ).toEqual(receipt({ deliveryNotes: null }))
  })

  it('spells a stock row in small letters', () => {
    expect(
      purchaseOrderReceiveRequestSchema.parse(
        receipt({
          items: [{ inventoryId: INVENTORY_ID.toUpperCase(), quantity: 1 }],
        }),
      ).items,
    ).toEqual([{ inventoryId: INVENTORY_ID, quantity: 1 }])
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['no items', { items: [] }, ['items:too_small']],
    [
      'more than 100 items',
      {
        items: Array.from({ length: 101 }, () => ({
          inventoryId: INVENTORY_ID,
          quantity: 1,
        })),
      },
      ['items:too_big'],
    ],
    [
      'a quantity of none',
      { items: [{ inventoryId: INVENTORY_ID, quantity: 0 }] },
      ['items.0.quantity:too_small'],
    ],
    [
      'a quantity below the hundredth',
      { items: [{ inventoryId: INVENTORY_ID, quantity: 1.005 }] },
      ['items.0.quantity:not_multiple_of'],
    ],
    [
      'a quantity above what a row holds',
      { items: [{ inventoryId: INVENTORY_ID, quantity: 100_000_000 }] },
      ['items.0.quantity:too_big'],
    ],
    [
      'a stock row that is no UUID',
      { items: [{ inventoryId: 'x', quantity: 1 }] },
      ['items.0.inventoryId:invalid_format'],
    ],
    [
      'notes of an item',
      { items: [{ inventoryId: INVENTORY_ID, quantity: 1, notes: null }] },
      ['items.0:unrecognized_keys'],
    ],
    [
      'the names the contract had',
      {
        items: undefined,
        receivedItems: [{ inventoryId: INVENTORY_ID, receivedQuantity: 1 }],
      },
      ['items:invalid_type', ':unrecognized_keys'],
    ],
    ['blank notes', { deliveryNotes: ' ' }, ['deliveryNotes:invalid_format']],
    [
      'no notes at all',
      { deliveryNotes: undefined },
      ['deliveryNotes:invalid_type'],
    ],
  ])('refuses %s', (_case, overrides, expected) => {
    expect(
      brokenBy(purchaseOrderReceiveRequestSchema, receipt(overrides)),
    ).toEqual(expected)
  })

  it('refuses a stock row named again where it is named again, in any letters, with every other rule of the items', () => {
    const value = receipt({
      items: [
        { inventoryId: INVENTORY_ID, quantity: 1 },
        { inventoryId: OTHER_INVENTORY_ID, quantity: 0.001 },
        { inventoryId: INVENTORY_ID.toUpperCase(), quantity: 2 },
      ],
    })

    expect(brokenBy(purchaseOrderReceiveRequestSchema, value)).toEqual([
      'items.1.quantity:not_multiple_of',
      'items.2.inventoryId:custom',
    ])
    expect(
      purchaseOrderReceiveRequestSchema
        .safeParse(value)
        .error?.issues.map(({ message }) => message)
        .at(-1),
    ).toBe('Must not repeat a stock row received earlier in the receipt')
  })
})

describe('reorderSuggestionSearchRequestSchema', () => {
  it('takes a salon alone, and a limit and a product to page from', () => {
    expect(
      reorderSuggestionSearchRequestSchema.parse({ salonId: SALON_ID }),
    ).toEqual({ salonId: SALON_ID })
    expect(
      reorderSuggestionSearchRequestSchema.parse({
        salonId: SALON_ID,
        limit: 100,
        cursor: PRODUCT_ID.toUpperCase(),
      }),
    ).toEqual({ salonId: SALON_ID, limit: 100, cursor: PRODUCT_ID })
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['no salon', {}, ['salonId:invalid_type']],
    ['a limit of none', { salonId: SALON_ID, limit: 0 }, ['limit:too_small']],
    ['a limit above 100', { salonId: SALON_ID, limit: 101 }, ['limit:too_big']],
    [
      'a limit that is no whole number',
      { salonId: SALON_ID, limit: 1.5 },
      ['limit:invalid_type'],
    ],
    [
      'a cursor that is no UUID',
      { salonId: SALON_ID, cursor: 'x' },
      ['cursor:invalid_format'],
    ],
    [
      'a threshold',
      { salonId: SALON_ID, threshold: 1 },
      [':unrecognized_keys'],
    ],
    [
      'a limit and a cursor stated without values',
      { salonId: SALON_ID, limit: undefined, cursor: undefined },
      ['limit:invalid_type', 'cursor:invalid_type'],
    ],
  ])('refuses %s', (_case, value, expected) => {
    expect(brokenBy(reorderSuggestionSearchRequestSchema, value)).toEqual(
      expected,
    )
  })
})
