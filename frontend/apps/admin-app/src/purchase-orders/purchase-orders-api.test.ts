import {
  answering,
  json,
  problem,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { salon } from '../bookings/components/examples'
import {
  colourLot,
  glovesRow,
  shampooRow,
} from '../inventory/components/examples'
import {
  ORDERS_OF_THE_SALON,
  pendingOrder,
  SUGGESTIONS_OF_THE_SALON,
  shippedOrder,
} from './components/examples'
import {
  approveOrder,
  cancelOrder,
  changeOrder,
  makeOrder,
  moveOrder,
  type OrderStep,
  purchaseOrderKeyOf,
  purchaseOrdersKeyOf,
  readEverySuggestion,
  readOrder,
  readOrderPage,
  receiveOrder,
  suggestionsKeyOf,
} from './purchase-orders-api'

/*
 * What the API answers to the purchase orders is met with the real API
 * (`purchase-orders.integration.test.tsx`). Here are the answers a test
 * cannot bring about there, and what is asked.
 */

type Answer = () => Response | Promise<Response>

const ORDER = {
  salonId: salon.id,
  supplier: '東京ビューティーサプライ',
  items: [
    { inventoryId: colourLot.id, quantity: 12, unitPrice: 800, notes: null },
    { inventoryId: glovesRow.id, quantity: 2.5, unitPrice: 1200, notes: null },
  ],
  taxAmount: 1260,
  shippingCost: null,
  expectedDelivery: '2026-11-26T15:00:00.000Z',
  paymentTerms: null,
  notes: null,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

/** The paths and the queries of the requests that were sent */
const askedOf = (fetched: ReturnType<typeof answering>) =>
  fetched.mock.calls.map(([asked]) => {
    const url = new URL(new Request(asked).url)

    return [url.pathname, Object.fromEntries(url.searchParams)]
  })

describe('purchaseOrdersKeyOf and purchaseOrderKeyOf', () => {
  it('should read the orders below the salon, and an order by its ID in small letters', () => {
    expect(purchaseOrdersKeyOf(salon.id)).toEqual([
      'salons',
      salon.id,
      'purchaseOrders',
    ])
    expect(purchaseOrderKeyOf(pendingOrder.id.toUpperCase())).toEqual([
      'purchaseOrder',
      pendingOrder.id,
    ])
  })
})

describe('readOrderPage', () => {
  it('should ask for a page of twenty orders of the conditions after the cursor', async () => {
    // Arrange
    const fetched = answering(() =>
      json(200, {
        data: ORDERS_OF_THE_SALON,
        meta: { total: 23, nextCursor: 'next', prevCursor: null },
        links: null,
      }),
    )

    // Act
    const page = await readOrderPage(
      { salonId: salon.id, status: 'pending', supplier: 'A&B 商事' },
      'cursor',
    )

    // Assert
    expect(page).toEqual({
      type: 'found',
      items: ORDERS_OF_THE_SALON,
      total: 23,
      nextCursor: 'next',
    })
    expect(askedOf(fetched)).toEqual([
      [
        '/api/v1/purchase-orders',
        {
          salonId: salon.id,
          status: 'pending',
          supplier: 'A&B 商事',
          cursor: 'cursor',
          limit: '20',
        },
      ],
    ])
  })

  it.each<[string, Answer, string]>([
    ['the account', () => problem(403), 'forbidden'],
    ['a salon removed meanwhile', () => problem(400), 'failed'],
    ...UNREAD,
  ])('should read no orders after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const page = await readOrderPage({ salonId: salon.id }, undefined)

    // Assert
    expect(page).toEqual({ type })
  })
})

describe('readOrder', () => {
  it('should ask for the order by its ID', async () => {
    // Arrange
    const fetched = answering(() =>
      json(200, { data: pendingOrder, meta: null, links: null }),
    )

    // Act
    const read = await readOrder(pendingOrder.id)

    // Assert
    expect(read).toEqual({ type: 'found', order: pendingOrder })
    expect(askedOf(fetched)).toEqual([
      [`/api/v1/purchase-orders/${pendingOrder.id}`, {}],
    ])
  })

  it.each<[string, Answer, string]>([
    ['an ID that is none', () => problem(400), 'notFound'],
    [
      'an order of no salon the account reaches',
      () => problem(404),
      'notFound',
    ],
    ['the role of the account', () => problem(403), 'forbidden'],
    ...UNREAD,
  ])('should read no order after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readOrder(pendingOrder.id)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('makeOrder', () => {
  it('should send the order, and hand over the draft that was made', async () => {
    // Arrange
    const fetched = answering(() =>
      json(201, { data: pendingOrder, meta: null, links: null }),
    )

    // Act
    const made = await makeOrder(ORDER)

    // Assert
    expect(made).toEqual({ type: 'made', order: pendingOrder })
    const [asked] = fetched.mock.calls.map(
      ([input, init]) => new Request(input, init),
    )
    expect(asked?.method).toBe('POST')
    expect(new URL(asked?.url ?? '').pathname).toBe('/api/v1/purchase-orders')
    expect(await asked?.json()).toEqual(ORDER)
  })

  it.each<[string, Answer, unknown]>([
    [
      'a row that is no longer among those of the salon',
      () =>
        problem(400, [
          { field: 'items.0.unitPrice', rule: 'too_big' },
          { field: 'items.1.inventoryId', rule: 'not_found' },
        ]),
      { type: 'rowsChanged' },
    ],
    [
      'a salon removed meanwhile',
      () => problem(400, [{ field: 'salonId', rule: 'not_found' }]),
      { type: 'failed' },
    ],
    [
      'values the API does not take',
      () =>
        problem(400, [
          { field: 'items.0.unitPrice', rule: 'too_big' },
          { field: 'items.0.inventoryId', rule: 'custom' },
        ]),
      {
        type: 'invalid',
        values: [
          { field: 'items.0.unitPrice', rule: 'too_big' },
          { field: 'items.0.inventoryId', rule: 'custom' },
        ],
      },
    ],
    ['the account', () => problem(403), { type: 'forbidden' }],
    ['a body that is too large', () => problem(413), { type: 'failed' }],
    ['a body of another type', () => problem(415), { type: 'failed' }],
    ...UNREAD.map(([name, answer, type]): [string, Answer, unknown] => [
      name,
      answer,
      { type },
    ]),
  ])('should make no order after %s', async (_, given, outcome) => {
    // Arrange
    answering(given)

    // Act
    const made = await makeOrder(ORDER)

    // Assert
    expect(made).toEqual(outcome)
  })
})

/** The method, the path and the body of the one request that was sent */
const sentOf = async (fetched: ReturnType<typeof answering>) => {
  const [asked] = fetched.mock.calls.map(
    ([input, init]) => new Request(input, init),
  )
  const body = await asked?.text()

  return [
    asked?.method,
    new URL(asked?.url ?? '').pathname,
    body === '' || body === undefined ? undefined : JSON.parse(body),
  ]
}

const APPROVED = { ...pendingOrder, status: 'approved' }

/** The operations on the status, each as it is called, with what it sends */
const STEPS: [string, () => Promise<OrderStep>, unknown[]][] = [
  [
    'moveOrder',
    () => moveOrder(pendingOrder.id, 'ordered'),
    [
      'PATCH',
      `/api/v1/purchase-orders/${pendingOrder.id}`,
      { status: 'ordered' },
    ],
  ],
  [
    'approveOrder',
    () => approveOrder(pendingOrder.id),
    ['POST', `/api/v1/purchase-orders/${pendingOrder.id}/approve`, undefined],
  ],
  [
    'cancelOrder',
    () => cancelOrder(pendingOrder.id, { cancellationReason: '在庫切れ' }),
    [
      'POST',
      `/api/v1/purchase-orders/${pendingOrder.id}/cancel`,
      { cancellationReason: '在庫切れ' },
    ],
  ],
]

describe.each(STEPS)('%s', (_, step, sent) => {
  it('should send the operation, and hand over the order it changed', async () => {
    // Arrange
    const fetched = answering(() =>
      json(200, { data: APPROVED, meta: null, links: null }),
    )

    // Act
    const changed = await step()

    // Assert
    expect(changed).toEqual({ type: 'changed', order: APPROVED })
    expect(await sentOf(fetched)).toEqual(sent)
  })

  it.each<[string, Answer, unknown]>([
    [
      'a status the operation is not for',
      () => problem(409),
      { type: 'conflict' },
    ],
    ['an order that is not there', () => problem(404), { type: 'notFound' }],
    ['the account', () => problem(403), { type: 'forbidden' }],
    ['a refused ID or body', () => problem(400), { type: 'failed' }],
    ['a body that is too large', () => problem(413), { type: 'failed' }],
    ['a body of another type', () => problem(415), { type: 'failed' }],
    ...UNREAD.map(([name, answer, type]): [string, Answer, unknown] => [
      name,
      answer,
      { type },
    ]),
  ])('should change nothing after %s', async (_name, given, outcome) => {
    // Arrange
    answering(given)

    // Act
    const changed = await step()

    // Assert
    expect(changed).toEqual(outcome)
  })
})

describe('changeOrder', () => {
  it('should send what was changed, and hand over the order it changed', async () => {
    // Arrange
    const fetched = answering(() =>
      json(200, { data: pendingOrder, meta: null, links: null }),
    )

    // Act
    const changed = await changeOrder(pendingOrder.id, {
      expectedDelivery: null,
      notes: '至急',
    })

    // Assert
    expect(changed).toEqual({ type: 'changed', order: pendingOrder })
    expect(await sentOf(fetched)).toEqual([
      'PATCH',
      `/api/v1/purchase-orders/${pendingOrder.id}`,
      { expectedDelivery: null, notes: '至急' },
    ])
  })

  it.each<[string, Answer, unknown]>([
    [
      'values the API does not take',
      () =>
        problem(400, [{ field: 'expectedDelivery', rule: 'invalid_format' }]),
      {
        type: 'invalid',
        values: [{ field: 'expectedDelivery', rule: 'invalid_format' }],
      },
    ],
    [
      'an order delivered or cancelled meanwhile',
      () => problem(409),
      { type: 'conflict' },
    ],
    ['an order that is not there', () => problem(404), { type: 'notFound' }],
    ['the account', () => problem(403), { type: 'forbidden' }],
    ['a body that is too large', () => problem(413), { type: 'failed' }],
    ['a body of another type', () => problem(415), { type: 'failed' }],
    ...UNREAD.map(([name, answer, type]): [string, Answer, unknown] => [
      name,
      answer,
      { type },
    ]),
  ])('should change nothing after %s', async (_name, given, outcome) => {
    // Arrange
    answering(given)

    // Act
    const changed = await changeOrder(pendingOrder.id, { notes: null })

    // Assert
    expect(changed).toEqual(outcome)
  })
})

describe('receiveOrder', () => {
  const RECEIPT = {
    items: [
      { inventoryId: colourLot.id, quantity: 12 },
      { inventoryId: shampooRow.id, quantity: 2 },
    ],
    deliveryNotes: '2 本は後日',
  }

  it('should send the goods that came, and hand over the order it delivered', async () => {
    // Arrange
    const delivered = { ...shippedOrder, status: 'delivered' }
    const fetched = answering(() =>
      json(200, { data: delivered, meta: null, links: null }),
    )

    // Act
    const received = await receiveOrder(shippedOrder.id, RECEIPT)

    // Assert
    expect(received).toEqual({ type: 'received', order: delivered })
    expect(await sentOf(fetched)).toEqual([
      'POST',
      `/api/v1/purchase-orders/${shippedOrder.id}/receive`,
      RECEIPT,
    ])
  })

  it.each<[string, Answer, unknown]>([
    [
      'a row removed meanwhile',
      () =>
        problem(400, [
          { field: 'items.0.quantity', rule: 'too_big' },
          { field: 'items.1.inventoryId', rule: 'not_found' },
        ]),
      { type: 'rowsChanged' },
    ],
    [
      'values the API does not take',
      () => problem(400, [{ field: 'items.0.quantity', rule: 'too_big' }]),
      {
        type: 'invalid',
        values: [{ field: 'items.0.quantity', rule: 'too_big' }],
      },
    ],
    [
      'an order no longer ordered or shipped, or a stock too large',
      () => problem(409),
      { type: 'conflict' },
    ],
    ['an order that is not there', () => problem(404), { type: 'notFound' }],
    ['the account', () => problem(403), { type: 'forbidden' }],
    ['a body that is too large', () => problem(413), { type: 'failed' }],
    ['a body of another type', () => problem(415), { type: 'failed' }],
    ...UNREAD.map(([name, answer, type]): [string, Answer, unknown] => [
      name,
      answer,
      { type },
    ]),
  ])('should receive nothing after %s', async (_name, given, outcome) => {
    // Arrange
    answering(given)

    // Act
    const received = await receiveOrder(shippedOrder.id, RECEIPT)

    // Assert
    expect(received).toEqual(outcome)
  })
})

describe('suggestionsKeyOf', () => {
  it('should read the suggestions below the orders of the salon', () => {
    expect(suggestionsKeyOf(salon.id)).toEqual([
      'salons',
      salon.id,
      'purchaseOrders',
      'suggestions',
    ])
  })
})

describe('readEverySuggestion', () => {
  it('should read the suggestions of the salon to their end, in the largest pages', async () => {
    // Arrange
    const [colour, shampoo, gloves] = SUGGESTIONS_OF_THE_SALON
    const fetched = answering((request) =>
      new URL(request.url).searchParams.has('cursor')
        ? json(200, {
            data: [gloves],
            meta: { total: 3, nextCursor: null, prevCursor: null },
            links: null,
          })
        : json(200, {
            data: [colour, shampoo],
            meta: { total: 3, nextCursor: 'next', prevCursor: null },
            links: null,
          }),
    )

    // Act
    const read = await readEverySuggestion(salon.id)

    // Assert
    expect(read).toEqual({ type: 'found', items: SUGGESTIONS_OF_THE_SALON })
    expect(askedOf(fetched)).toEqual([
      [
        '/api/v1/purchase-orders/reorder-suggestions',
        { salonId: salon.id, limit: '100' },
      ],
      [
        '/api/v1/purchase-orders/reorder-suggestions',
        { salonId: salon.id, cursor: 'next', limit: '100' },
      ],
    ])
  })

  it.each<[string, Answer, string]>([
    ['the account', () => problem(403), 'forbidden'],
    ['a salon removed meanwhile', () => problem(400), 'failed'],
    ...UNREAD,
  ])('should read no suggestions after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readEverySuggestion(salon.id)

    // Assert
    expect(read).toEqual({ type })
  })
})
