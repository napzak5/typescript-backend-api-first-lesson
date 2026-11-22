import {
  answering,
  asked,
  page,
  problem,
  record,
  sent,
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
    const fetched = answering(() => page(ORDERS_OF_THE_SALON, 'next', 23))

    // Act
    const read = await readOrderPage(
      { salonId: salon.id, status: 'pending', supplier: 'A&B 商事' },
      'cursor',
    )

    // Assert
    expect(read).toEqual({
      type: 'found',
      items: ORDERS_OF_THE_SALON,
      total: 23,
      nextCursor: 'next',
    })
    expect(asked(fetched)).toEqual([
      `GET /purchase-orders?cursor=cursor&limit=20&salonId=${salon.id}&status=pending&supplier=A%26B 商事`,
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
    const read = await readOrderPage({ salonId: salon.id }, undefined)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('readOrder', () => {
  it('should ask for the order by its ID', async () => {
    // Arrange
    const fetched = answering(() => record(200, pendingOrder))

    // Act
    const read = await readOrder(pendingOrder.id)

    // Assert
    expect(read).toEqual({ type: 'found', order: pendingOrder })
    expect(asked(fetched)).toEqual([`GET /purchase-orders/${pendingOrder.id}`])
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
    const fetched = answering(() => record(201, pendingOrder))

    // Act
    const made = await makeOrder(ORDER)

    // Assert
    expect(made).toEqual({ type: 'made', order: pendingOrder })
    expect(asked(fetched)).toEqual(['POST /purchase-orders'])
    expect(await sent(fetched)).toEqual([ORDER])
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

const APPROVED = { ...pendingOrder, status: 'approved' }

/** The operations on the status, each as it is called, with what it asks for and the bodies it sends */
const STEPS: [string, () => Promise<OrderStep>, string, unknown[]][] = [
  [
    'moveOrder',
    () => moveOrder(pendingOrder.id, 'ordered'),
    `PATCH /purchase-orders/${pendingOrder.id}`,
    [{ status: 'ordered' }],
  ],
  [
    'approveOrder',
    () => approveOrder(pendingOrder.id),
    `POST /purchase-orders/${pendingOrder.id}/approve`,
    [],
  ],
  [
    'cancelOrder',
    () => cancelOrder(pendingOrder.id, { cancellationReason: '在庫切れ' }),
    `POST /purchase-orders/${pendingOrder.id}/cancel`,
    [{ cancellationReason: '在庫切れ' }],
  ],
]

describe.each(STEPS)('%s', (_, step, line, bodies) => {
  it('should send the operation, and hand over the order it changed', async () => {
    // Arrange
    const fetched = answering(() => record(200, APPROVED))

    // Act
    const changed = await step()

    // Assert
    expect(changed).toEqual({ type: 'changed', order: APPROVED })
    expect(asked(fetched)).toEqual([line])
    expect(await sent(fetched)).toEqual(bodies)
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
    const fetched = answering(() => record(200, pendingOrder))

    // Act
    const changed = await changeOrder(pendingOrder.id, {
      expectedDelivery: null,
      notes: '至急',
    })

    // Assert
    expect(changed).toEqual({ type: 'changed', order: pendingOrder })
    expect(asked(fetched)).toEqual([
      `PATCH /purchase-orders/${pendingOrder.id}`,
    ])
    expect(await sent(fetched)).toEqual([
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
    const fetched = answering(() => record(200, delivered))

    // Act
    const received = await receiveOrder(shippedOrder.id, RECEIPT)

    // Assert
    expect(received).toEqual({ type: 'received', order: delivered })
    expect(asked(fetched)).toEqual([
      `POST /purchase-orders/${shippedOrder.id}/receive`,
    ])
    expect(await sent(fetched)).toEqual([RECEIPT])
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
        ? page([gloves], null, 3)
        : page([colour, shampoo], 'next', 3),
    )

    // Act
    const read = await readEverySuggestion(salon.id)

    // Assert
    expect(read).toEqual({ type: 'found', items: SUGGESTIONS_OF_THE_SALON })
    expect(asked(fetched)).toEqual([
      `GET /purchase-orders/reorder-suggestions?limit=100&salonId=${salon.id}`,
      `GET /purchase-orders/reorder-suggestions?cursor=next&limit=100&salonId=${salon.id}`,
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
