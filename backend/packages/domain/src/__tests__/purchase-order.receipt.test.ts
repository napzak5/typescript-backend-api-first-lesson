import type { OrderStatusType } from '@beauty-salon-backend/generated'
import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import {
  ListReorderSuggestionsUseCase,
  type PurchaseOrderUseCaseDependencies,
  planGoodsReceipt,
  ReceivePurchaseOrderUseCase,
  refusalOfGoodsReceipt,
} from '../business-logic/purchase-order'
import { PurchaseOrderReadMapper } from '../mappers/read/purchase-order.mapper'
import type { Actor } from '../models/auth'
import { inventoryIdSchema } from '../models/inventory'
import type {
  PurchaseOrderReceipt,
  ReorderSuggestionListing,
} from '../repositories/purchase-order.repository'
import {
  purchaseOrderReceiveRequestSchema,
  reorderSuggestionSearchRequestSchema,
} from '../schemas/purchase-order.schema'
import { type DomainError, DomainErrors } from '../shared'
import { actors, STAFF_ID } from './auth-fixtures'
import { brokenRules, OTHER_SALON_ID, SALON_ID } from './fixtures'
import { INVENTORY_ID, OTHER_INVENTORY_ID } from './inventory-fixtures'
import { PRODUCT_ID } from './product-fixtures'
import {
  dbReorderSuggestion,
  PURCHASE_ORDER_ID,
  purchaseOrderDependencies,
} from './purchase-order-fixtures'

const THIRD_INVENTORY_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e99'
const OTHER_PRODUCT_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f99'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())

/** The rules a value breaks, as `path:code`; empty when it breaks none. */
const brokenBy = (schema: z.ZodType, value: unknown): string[] =>
  schema
    .safeParse(value)
    .error?.issues.map(({ path, code }) => `${path.join('.')}:${code}`) ?? []

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** Whether no repository was asked anything. */
const untouched = ({
  purchaseOrderRepository,
  salonRepository,
}: PurchaseOrderUseCaseDependencies): boolean =>
  [
    ...Object.values(purchaseOrderRepository),
    ...Object.values(salonRepository),
  ].every((method) => vi.mocked(method).mock.calls.length === 0)

const members: [string, Actor][] = [
  ['an owner', actors.ofSalon('owner')],
  ['a manager', actors.ofSalon('manager')],
  ['a staff member', actors.ofSalon('staff')],
]

const outsiders: [string, Actor][] = [
  ['a customer', actors.customer],
  ['a customer account without a profile', actors.customerWithoutProfile],
  ['an account of no scope', actors.withoutScope],
]

const rowId = (id: string) => inventoryIdSchema.parse(id)

/** The items of an order as stored: ten bottles, two and a half litres, and a deleted row. */
const ordered = [
  { inventoryId: INVENTORY_ID, quantity: '10.00', unitPrice: 1500 },
  { inventoryId: OTHER_INVENTORY_ID, quantity: '2.50', unitPrice: 2999 },
  { inventoryId: null, quantity: '4.00', unitPrice: 800 },
]

describe('refusalOfGoodsReceipt', () => {
  it.each<[OrderStatusType]>([['ordered'], ['shipped']])(
    'receives the goods of a %s order',
    (status) => {
      expect(refusalOfGoodsReceipt(status)).toBeNull()
    },
  )

  it.each<[OrderStatusType]>([['delivered'], ['cancelled']])(
    'refuses a %s order as closed',
    (status) => {
      expect(refusalOfGoodsReceipt(status)).toEqual({ type: 'closed', status })
    },
  )

  it.each<[OrderStatusType]>([['draft'], ['pending'], ['approved']])(
    'refuses a %s order as not placed yet',
    (status) => {
      expect(refusalOfGoodsReceipt(status)).toEqual({
        type: 'notFromStatus',
        status,
      })
    },
  )
})

describe('planGoodsReceipt', () => {
  it('records a purchase of each item named, in the order of the receipt, at the unit price of the item, the cost rounded half up', () => {
    expect(
      planGoodsReceipt(ordered, [
        { inventoryId: rowId(OTHER_INVENTORY_ID), quantity: 1.25 },
        { inventoryId: rowId(INVENTORY_ID), quantity: 10 },
      ]),
    ).toEqual({
      type: 'planned',
      movements: [
        // 1.25 × 2999 = 3748.75
        {
          inventoryId: OTHER_INVENTORY_ID,
          quantity: '1.25',
          unitCost: 2999,
          totalCost: 3749,
        },
        {
          inventoryId: INVENTORY_ID,
          quantity: '10.00',
          unitCost: 1500,
          totalCost: 15000,
        },
      ],
    })
  })

  it('rounds a half yen up, and takes all of an item to the hundredth', () => {
    expect(
      planGoodsReceipt(ordered, [
        { inventoryId: rowId(OTHER_INVENTORY_ID), quantity: 2.5 },
      ]),
    ).toEqual({
      type: 'planned',
      movements: [
        {
          inventoryId: OTHER_INVENTORY_ID,
          quantity: '2.50',
          unitCost: 2999,
          totalCost: 7498,
        },
      ],
    })
  })

  it('compares quantities in hundredths, not as the binary fractions they are', () => {
    const tenths = [
      { inventoryId: INVENTORY_ID, quantity: '0.30', unitPrice: 100 },
    ]

    expect(
      planGoodsReceipt(tenths, [
        { inventoryId: rowId(INVENTORY_ID), quantity: 0.1 + 0.2 },
      ]),
    ).toMatchObject({ type: 'planned' })
  })

  it('refuses more than an item orders, by a hundredth, saying what it orders', () => {
    expect(
      planGoodsReceipt(ordered, [
        { inventoryId: rowId(INVENTORY_ID), quantity: 10.01 },
      ]),
    ).toEqual({
      type: 'refused',
      refusals: [{ type: 'moreThanOrdered', index: 0, ordered: 10 }],
    })
  })

  it('refuses every row that no item is for, and every item over its quantity, by their places, and records nothing', () => {
    expect(
      planGoodsReceipt(ordered, [
        { inventoryId: rowId(INVENTORY_ID), quantity: 1 },
        { inventoryId: rowId(THIRD_INVENTORY_ID), quantity: 1 },
        { inventoryId: rowId(OTHER_INVENTORY_ID), quantity: 3 },
      ]),
    ).toEqual({
      type: 'refused',
      refusals: [
        { type: 'notOrdered', index: 1 },
        { type: 'moreThanOrdered', index: 2, ordered: 2.5 },
      ],
    })
  })

  it('takes no item for a row of none of the items, whatever was deleted', () => {
    expect(planGoodsReceipt(ordered.slice(2), [])).toEqual({
      type: 'planned',
      movements: [],
    })
    expect(
      planGoodsReceipt(ordered.slice(1), [
        { inventoryId: rowId(INVENTORY_ID), quantity: 1 },
      ]),
    ).toEqual({ type: 'refused', refusals: [{ type: 'notOrdered', index: 0 }] })
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

describe('PurchaseOrderReadMapper.toApiReorderSuggestions', () => {
  it('names every value as it is, the quantities as numbers and the date of the latest order in ISO 8601', () => {
    expect(
      PurchaseOrderReadMapper.toApiReorderSuggestions([
        dbReorderSuggestion(),
        dbReorderSuggestion({
          productId: OTHER_PRODUCT_ID,
          supplier: null,
          onOrderQuantity: '0',
          maximumStock: null,
          suggestedQuantity: '7.50',
          lastOrderDate: null,
        }),
      ]),
    ).toEqual({
      type: 'success',
      data: [
        {
          productId: PRODUCT_ID,
          productCode: 'SHMP001',
          productName: 'Moisture Shampoo 500ml',
          unit: 'bottle',
          supplier: 'Beauty Supply Tokyo',
          currentStock: 3,
          onOrderQuantity: 2,
          reorderPoint: 10,
          maximumStock: 24,
          suggestedQuantity: 19,
          lastOrderDate: '2026-11-14T09:00:00.123Z',
        },
        {
          productId: OTHER_PRODUCT_ID,
          productCode: 'SHMP001',
          productName: 'Moisture Shampoo 500ml',
          unit: 'bottle',
          supplier: null,
          currentStock: 3,
          onOrderQuantity: 0,
          reorderPoint: 10,
          maximumStock: null,
          suggestedQuantity: 7.5,
          lastOrderDate: null,
        },
      ],
    })
  })

  it('tells a suggestion it cannot read as an error of the database', () => {
    expect(
      PurchaseOrderReadMapper.toApiReorderSuggestions([
        dbReorderSuggestion(),
        dbReorderSuggestion({
          productId: OTHER_PRODUCT_ID,
          lastOrderDate: 'x',
        }),
      ]),
    ).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `Reorder suggestion of product ${OTHER_PRODUCT_ID} does not match the API model`,
      },
    })
  })
})

describe('ReceivePurchaseOrderUseCase', () => {
  const RECEIPT = {
    items: [{ inventoryId: INVENTORY_ID, quantity: 10 }],
    deliveryNotes: '段ボール 2 箱',
  }

  const receive = (
    dependencies: PurchaseOrderUseCaseDependencies,
    actor: Actor = actors.admin,
    id: unknown = PURCHASE_ORDER_ID,
    input: unknown = RECEIPT,
  ) => new ReceivePurchaseOrderUseCase(dependencies).execute(actor, id, input)

  const answering = (receipt: PurchaseOrderReceipt) =>
    purchaseOrderDependencies({
      receive: vi.fn(async () => Result.success(receipt)),
    })

  it.each([['an administrator', actors.admin], ...members])(
    'receives the goods for %s, as the staff member they are, and answers with the delivered order',
    async (_who, actor) => {
      const dependencies = purchaseOrderDependencies()

      const result = await receive(dependencies, actor)

      expect(result).toMatchObject({
        type: 'success',
        data: {
          id: PURCHASE_ORDER_ID,
          status: 'delivered',
          actualDelivery: '2026-11-21T01:00:00.000Z',
        },
      })
      expect(dependencies.purchaseOrderRepository.receive).toHaveBeenCalledWith(
        actor === actors.admin
          ? { type: 'everySalon' }
          : { type: 'salon', salonId: SALON_ID },
        PURCHASE_ORDER_ID,
        {
          items: RECEIPT.items,
          deliveryNotes: '段ボール 2 箱',
          performedBy: actor === actors.admin ? null : STAFF_ID,
        },
      )
    },
  )

  it.each(outsiders)(
    'refuses %s before the ID is looked at',
    async (_who, actor) => {
      const dependencies = purchaseOrderDependencies()

      expect(await receive(dependencies, actor, 'x', null)).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses an ID that is no UUID before the request, and a request that breaks a rule', async () => {
    const dependencies = purchaseOrderDependencies()

    expect(rulesOf(await receive(dependencies, actors.admin, 'x', {}))).toEqual(
      ['id:invalid_format'],
    )
    expect(
      rulesOf(
        await receive(dependencies, actors.admin, PURCHASE_ORDER_ID, {
          ...RECEIPT,
          items: [],
        }),
      ),
    ).toEqual(['items:too_small'])
    expect(untouched(dependencies)).toBe(true)
  })

  it('does not find an order that is not there, or not within the reach', async () => {
    expect(await receive(answering({ type: 'notFound' }))).toEqual(
      Result.error(DomainErrors.notFound('PurchaseOrder', PURCHASE_ORDER_ID)),
    )
  })

  it('tells why where the order stands does not take the goods', async () => {
    expect(
      await receive(answering({ type: 'notFromStatus', status: 'approved' })),
    ).toEqual(
      Result.error(
        DomainErrors.conflict(
          `Purchase order ${PURCHASE_ORDER_ID} is approved: the goods of an ordered or shipped order are received`,
        ),
      ),
    )
    expect(
      await receive(answering({ type: 'closed', status: 'delivered' })),
    ).toEqual(
      Result.error(
        DomainErrors.conflict(
          `Purchase order ${PURCHASE_ORDER_ID} is delivered: a delivered or cancelled order does not change`,
        ),
      ),
    )
  })

  it('refuses every item the order does not take, as properties of the request', async () => {
    const result = await receive(
      answering({
        type: 'itemsRefused',
        refusals: [
          { type: 'notOrdered', index: 0 },
          { type: 'moreThanOrdered', index: 2, ordered: 2.5 },
        ],
      }),
    )

    expect(result).toEqual(
      Result.error(
        DomainErrors.validation('Invalid purchase order receipt', [
          {
            field: 'items.0.inventoryId',
            rule: 'not_found',
            message: 'Must name a stock row of an item of the order',
          },
          {
            field: 'items.2.quantity',
            rule: 'too_big',
            message: 'Must be at most 2.5, the quantity the item orders',
          },
        ]),
      ),
    )
  })

  it('tells a stock row that would hold too much as a conflict', async () => {
    expect(
      await receive(
        answering({ type: 'overLimit', inventoryId: rowId(INVENTORY_ID) }),
      ),
    ).toEqual(
      Result.error(
        DomainErrors.conflict(
          `The stock of row ${INVENTORY_ID} would go above 99999999.99`,
        ),
      ),
    )
  })

  it('passes on what the database could not do', async () => {
    expect(
      await receive(
        purchaseOrderDependencies({ receive: vi.fn(async () => databaseDown) }),
      ),
    ).toEqual(databaseDown)
  })
})

describe('ListReorderSuggestionsUseCase', () => {
  const list = (
    dependencies: PurchaseOrderUseCaseDependencies,
    actor: Actor = actors.admin,
    query: Result<unknown, DomainError> = Result.success({ salonId: SALON_ID }),
  ) => new ListReorderSuggestionsUseCase(dependencies).execute(actor, query)

  const listing = (
    listed: ReorderSuggestionListing,
  ): PurchaseOrderUseCaseDependencies =>
    purchaseOrderDependencies({
      listReorderSuggestions: vi.fn(async () => Result.success(listed)),
    })

  it.each([['an administrator', actors.admin], ...members])(
    'lists the suggestions of the salon for %s, 20 to a page',
    async (_who, actor) => {
      const dependencies = purchaseOrderDependencies()

      const result = await list(dependencies, actor)

      expect(result).toEqual({
        type: 'success',
        data: {
          data: [expect.objectContaining({ productId: PRODUCT_ID })],
          meta: {
            total: 1,
            limit: 20,
            hasMore: false,
            cursor: null,
            nextCursor: null,
            prevCursor: null,
          },
        },
      })
      expect(
        dependencies.purchaseOrderRepository.listReorderSuggestions,
      ).toHaveBeenCalledWith({ salonId: SALON_ID, limit: 20, after: null })
      expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    },
  )

  it('pages from the product of the cursor, and points to the next page from the last product of the page', async () => {
    const dependencies = listing({
      type: 'listed',
      suggestions: [
        dbReorderSuggestion({ productId: OTHER_PRODUCT_ID }),
        dbReorderSuggestion(),
      ],
      total: 5,
      hasMore: true,
    })

    const result = await list(
      dependencies,
      actors.admin,
      Result.success({ salonId: SALON_ID, limit: 2, cursor: PRODUCT_ID }),
    )

    expect(result).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: PRODUCT_ID,
          nextCursor: PRODUCT_ID,
        },
      },
    })
    expect(
      dependencies.purchaseOrderRepository.listReorderSuggestions,
    ).toHaveBeenCalledWith({ salonId: SALON_ID, limit: 2, after: PRODUCT_ID })
  })

  it.each(outsiders)(
    'refuses %s before the query is looked at',
    async (_who, actor) => {
      const dependencies = purchaseOrderDependencies()

      expect(
        await list(
          dependencies,
          actor,
          Result.error(DomainErrors.validation('Invalid query', [])),
        ),
      ).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('passes on a query the caller could not decode, and refuses one that breaks a rule', async () => {
    const dependencies = purchaseOrderDependencies()
    const undecoded = Result.error(
      DomainErrors.validation('Invalid reorder suggestion search', [
        { field: 'limit', rule: 'invalid_format', message: 'Must be a number' },
      ]),
    )

    expect(await list(dependencies, actors.admin, undecoded)).toEqual(undecoded)
    expect(
      rulesOf(await list(dependencies, actors.admin, Result.success({}))),
    ).toEqual(['salonId:invalid_type'])
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses a member of a salon who names another salon, before the salon is looked up', async () => {
    const dependencies = purchaseOrderDependencies()

    expect(
      await list(
        dependencies,
        actors.ofSalon('staff'),
        Result.success({ salonId: OTHER_SALON_ID }),
      ),
    ).toEqual(forbidden)
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses a salon that is not there, as a property of the query', async () => {
    const dependencies = purchaseOrderDependencies(
      {},
      { exists: vi.fn(async () => Result.success(false)) },
    )

    expect(rulesOf(await list(dependencies))).toEqual(['salonId:not_found'])
    expect(
      dependencies.purchaseOrderRepository.listReorderSuggestions,
    ).not.toHaveBeenCalled()
  })

  it('refuses a cursor that names no product of the salon', async () => {
    expect(await list(listing({ type: 'cursorNotFound' }))).toEqual(
      Result.error(
        DomainErrors.validation('Invalid reorder suggestion search', [
          {
            field: 'cursor',
            rule: 'not_found',
            message: 'Must name a product of the salon',
          },
        ]),
      ),
    )
  })

  it('passes on what the database could not do, of the salon or of the suggestions', async () => {
    expect(
      await list(
        purchaseOrderDependencies(
          {},
          { exists: vi.fn(async () => databaseDown) },
        ),
      ),
    ).toEqual(databaseDown)
    expect(
      await list(
        purchaseOrderDependencies({
          listReorderSuggestions: vi.fn(async () => databaseDown),
        }),
      ),
    ).toEqual(databaseDown)
  })
})
