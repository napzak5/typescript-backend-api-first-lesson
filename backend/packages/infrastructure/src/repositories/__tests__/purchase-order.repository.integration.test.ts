import {
  inventory,
  inventoryTransactions,
  purchaseOrderItems,
  purchaseOrders,
} from '@beauty-salon-backend/database'
import {
  type DbNewPurchaseOrder,
  type DbNewPurchaseOrderItem,
  type DbPurchaseOrderChanges,
  type InventoryId,
  inventoryIdSchema,
  type LedgerReach,
  type PurchaseOrderId,
  type PurchaseOrderListCriteria,
  type PurchaseOrderReceiptCriteria,
  productIdSchema,
  purchaseOrderIdSchema,
  type SalonId,
  salonIdSchema,
  staffIdSchema,
} from '@beauty-salon-backend/domain'
import { asc, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { PurchaseOrderRepository } from '../purchase-order.repository.impl'
import {
  insertProduct,
  insertPurchaseOrder,
  insertPurchaseOrderItem,
  insertSalon,
  insertStock,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new PurchaseOrderRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/** An ID the test chooses, so that rows are in an order of their IDs it knows. */
const idOf = (place: number) =>
  `00000000-0000-4000-8000-${String(place).padStart(12, '0')}`

const EVERY_SALON: LedgerReach = { type: 'everySalon' }

const reachOf = (salonId: SalonId): LedgerReach => ({ type: 'salon', salonId })

const RECEIVER = staffIdSchema.parse('0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a2c')

/** The values an order of each status needs besides it. */
const APPROVED_AT = '2026-11-30T00:00:00Z'
const PENDING: Parameters<typeof insertPurchaseOrder>[2] = {
  status: 'pending',
}
const ORDERED: Parameters<typeof insertPurchaseOrder>[2] = {
  status: 'ordered',
  approvedAt: APPROVED_AT,
}
const DELIVERED: Parameters<typeof insertPurchaseOrder>[2] = {
  status: 'delivered',
  approvedAt: APPROVED_AT,
  actualDelivery: '2026-12-01T00:00:00Z',
}
const CANCELLED: Parameters<typeof insertPurchaseOrder>[2] = {
  status: 'cancelled',
  cancelledAt: '2026-12-01T00:00:00Z',
  cancellationReason: '仕入れ先の欠品',
}

/** A salon in the table, by the ID a repository is given. */
const storedSalon = async (): Promise<SalonId> =>
  salonIdSchema.parse((await insertSalon(databases.database())).id)

/** A stock row of a product of the salon in the table, by the ID a repository is given. */
const storedRow = async (
  salonId: SalonId,
  product: Parameters<typeof insertProduct>[2] = {},
  row: Parameters<typeof insertStock>[3] = {},
) => {
  const db = databases.database()
  const stored = await insertStock(
    db,
    salonId,
    (await insertProduct(db, salonId, product)).id,
    row,
  )
  return { ...stored, id: inventoryIdSchema.parse(stored.id) }
}

/** An order of the salon in the table, by the ID a repository is given. */
const storedOrder = async (
  salonId: SalonId,
  overrides: Parameters<typeof insertPurchaseOrder>[2] = {},
) => {
  const order = await insertPurchaseOrder(
    databases.database(),
    salonId,
    overrides,
  )
  return { ...order, id: purchaseOrderIdSchema.parse(order.id) }
}

const storedItem = (
  orderId: string,
  inventoryId: string | null,
  overrides: Parameters<typeof insertPurchaseOrderItem>[3] = {},
) =>
  insertPurchaseOrderItem(databases.database(), orderId, inventoryId, overrides)

const storedOf = async (id: string) => {
  const [order] = await databases
    .database()
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, id))
  return order
}

const itemsOf = (orderId: string) =>
  databases
    .database()
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, orderId))

const rowOf = async (id: string) => {
  const [row] = await databases
    .database()
    .select()
    .from(inventory)
    .where(eq(inventory.id, id))
  return row
}

const movementsOf = (inventoryId: string) =>
  databases
    .database()
    .select()
    .from(inventoryTransactions)
    .where(eq(inventoryTransactions.inventoryId, inventoryId))
    .orderBy(asc(inventoryTransactions.createdAt))

const failureOf = (message: string) => ({
  type: 'error',
  error: { type: 'database', message, cause: null },
})

/** An order a create writes: 3200 yen with the tax, from a supplier of hair care. */
const orderOf = (salonId: SalonId): DbNewPurchaseOrder => ({
  salonId,
  supplier: '櫛商事',
  subtotal: 2900,
  taxAmount: 290,
  shippingCost: 10,
  totalAmount: 3200,
  expectedDelivery: '2026-12-10T00:00:00.000Z',
  paymentTerms: '月末締め翌月末払い',
  notes: null,
  createdBy: null,
})

const itemOf = (
  inventoryId: InventoryId,
  overrides: Partial<DbNewPurchaseOrderItem> = {},
): DbNewPurchaseOrderItem => ({
  inventoryId,
  quantity: '10.00',
  unitPrice: 200,
  totalPrice: 2000,
  notes: null,
  ...overrides,
})

describe('PurchaseOrderRepository.create', () => {
  it('should write the draft and its items in the order of the request, with what they copy of the product of each row', async () => {
    // Arrange
    const salonId = await storedSalon()
    const shampoo = await storedRow(
      salonId,
      { productCode: 'SH-1', name: 'シャンプー', unit: 'ml' },
      { id: idOf(2) },
    )
    const towels = await storedRow(
      salonId,
      { productCode: 'TW-1', name: 'タオル', unit: '枚' },
      { id: idOf(1) },
    )

    // Act
    const created = await repository().create({
      order: orderOf(salonId),
      items: [
        itemOf(shampoo.id),
        itemOf(towels.id, {
          quantity: '3.00',
          unitPrice: 300,
          totalPrice: 900,
        }),
      ],
      orderNumber: 'PO-2026-0001',
    })

    // Assert
    const items = [
      {
        inventoryId: shampoo.id,
        productCode: 'SH-1',
        productName: 'シャンプー',
        unit: 'ml',
        quantity: '10.00',
        unitPrice: 200,
        totalPrice: 2000,
        sortOrder: 0,
      },
      {
        inventoryId: towels.id,
        productCode: 'TW-1',
        productName: 'タオル',
        unit: '枚',
        quantity: '3.00',
        unitPrice: 300,
        totalPrice: 900,
        sortOrder: 1,
      },
    ]
    expect(created).toMatchObject({
      type: 'success',
      data: {
        type: 'created',
        order: {
          order: {
            ...orderOf(salonId),
            expectedDelivery: expect.any(String),
            orderNumber: 'PO-2026-0001',
            status: 'draft',
            approvedAt: null,
          },
          items,
        },
      },
    })
    const [stored] = await databases
      .database()
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.salonId, salonId))
    expect(
      (await itemsOf(stored?.id ?? UNKNOWN_ID)).toSorted(
        (a, b) => a.sortOrder - b.sortOrder,
      ),
    ).toMatchObject(items)
  })

  it('should answer the places of the items whose row is not of the salon, and write nothing', async () => {
    // Arrange
    const salonId = await storedSalon()
    const mine = await storedRow(salonId)
    const away = await storedRow(await storedSalon())

    // Act
    const created = await repository().create({
      order: orderOf(salonId),
      items: [
        itemOf(mine.id),
        itemOf(away.id),
        itemOf(inventoryIdSchema.parse(UNKNOWN_ID)),
      ],
      orderNumber: 'PO-2026-0001',
    })

    // Assert
    expect(created).toEqual({
      type: 'success',
      data: { type: 'rowsNotFound', indexes: [1, 2] },
    })
    expect(
      await databases
        .database()
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.salonId, salonId)),
    ).toEqual([])
  })

  it('should write no order of the number of another order', async () => {
    // Arrange
    const salonId = await storedSalon()
    const row = await storedRow(salonId)
    const taken = await storedOrder(await storedSalon(), {
      orderNumber: 'PO-2026-0001',
    })

    // Act
    const created = await repository().create({
      order: orderOf(salonId),
      items: [itemOf(row.id)],
      orderNumber: 'PO-2026-0001',
    })

    // Assert
    expect(created).toEqual({
      type: 'success',
      data: { type: 'orderNumberTaken' },
    })
    expect(await itemsOf(taken.id)).toEqual([])
  })

  it('should find no row that the deletion it waited for took away', async () => {
    // Arrange
    const salonId = await storedSalon()
    const row = await storedRow(salonId)

    // Act
    const created = await databases.whileHeld(
      (held) => held`select id from inventory where id = ${row.id} for update`,
      (held) => held`delete from inventory where id = ${row.id}`,
      () =>
        repository().create({
          order: orderOf(salonId),
          items: [itemOf(row.id)],
          orderNumber: 'PO-2026-0001',
        }),
    )

    // Assert
    expect(created).toEqual({
      type: 'success',
      data: { type: 'rowsNotFound', indexes: [0] },
    })
  })

  it('should copy the product as the change it waited for left it', async () => {
    // Arrange
    const salonId = await storedSalon()
    const row = await storedRow(salonId)

    // Act
    const created = await databases.whileHeld(
      (held) =>
        held`select id from products where id = ${row.productId} for update`,
      (held) =>
        held`update products set name = '業務用シャンプー' where id = ${row.productId}`,
      () =>
        repository().create({
          order: orderOf(salonId),
          items: [itemOf(row.id)],
          orderNumber: 'PO-2026-0001',
        }),
    )

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: {
        type: 'created',
        order: { items: [{ productName: '業務用シャンプー' }] },
      },
    })
  })

  it('should answer that the insert of the items returned no row when a trigger skips it', async () => {
    // Arrange
    const salonId = await storedSalon()
    const first = await storedRow(salonId)
    const second = await storedRow(salonId)
    await databases.skipWrites('purchase_order_items', 'INSERT')

    // Act
    const created = await repository().create({
      order: orderOf(salonId),
      items: [itemOf(first.id), itemOf(second.id)],
      orderNumber: 'PO-2026-0001',
    })

    // Assert
    expect(created).toEqual(
      failureOf('Insert of purchase order items returned no row for 2 of 2'),
    )
  })
})

describe('PurchaseOrderRepository.findById', () => {
  it.each<[string, (salonId: SalonId) => LedgerReach]>([
    ['its salon', reachOf],
    ['every salon', () => EVERY_SALON],
  ])(
    'should find the order with its items in their order for a reader of %s',
    async (_case, reach) => {
      // Arrange
      const salonId = await storedSalon()
      const order = await storedOrder(salonId)
      const second = await storedItem(order.id, null, { sortOrder: 1 })
      const first = await storedItem(order.id, null, { sortOrder: 0 })

      // Act
      const found = await repository().findById(reach(salonId), order.id)

      // Assert
      expect(found).toEqual({
        type: 'success',
        data: { order, items: [first, second] },
      })
    },
  )

  it.each<[string, () => Promise<string>]>([
    [
      'order of another salon',
      async () => (await storedOrder(await storedSalon())).id,
    ],
    ['order of an ID that names none', async () => UNKNOWN_ID],
  ])('should find no %s', async (_case, idOfOrder) => {
    // Arrange
    const salonId = await storedSalon()

    // Act
    const found = await repository().findById(
      reachOf(salonId),
      purchaseOrderIdSchema.parse(await idOfOrder()),
    )

    // Assert
    expect(found).toEqual({ type: 'success', data: null })
  })
})

/**
 * Four orders of a salon: on 2026-12-01 a draft with two items, two of
 * 2026-12-02 at one moment, whose IDs are in the other order and one of
 * which has an item, and one ordered from another supplier at a moment
 * with microseconds on 2026-12-03. Another salon has an order of
 * 2026-12-02 too.
 */
const storedLedger = async () => {
  const salonId = await storedSalon()
  const other = await storedSalon()
  const order = (
    place: number,
    orderDate: string,
    overrides: Parameters<typeof insertPurchaseOrder>[2] = {},
  ) => storedOrder(salonId, { id: idOf(place), orderDate, ...overrides })
  const draft = await order(41, '2026-12-01T10:00:00Z')
  const sameMomentLater = await order(42, '2026-12-02T10:00:00Z', PENDING)
  const sameMomentFirst = await order(43, '2026-12-02T10:00:00Z', PENDING)
  const ordered = await order(44, '2026-12-03T10:00:00.123456Z', {
    ...ORDERED,
    supplier: '髪材の店',
  })
  const away = await storedOrder(other, {
    id: idOf(45),
    orderDate: '2026-12-02T10:00:00Z',
  })
  const draftItems = [
    await storedItem(draft.id, null, { sortOrder: 0 }),
    await storedItem(draft.id, null, { sortOrder: 1 }),
  ]
  const firstItems = [await storedItem(sameMomentFirst.id, null)]
  return {
    salonId,
    other,
    orders: {
      draft: { order: draft, items: draftItems },
      sameMomentFirst: { order: sameMomentFirst, items: firstItems },
      sameMomentLater: { order: sameMomentLater, items: [] },
      ordered: { order: ordered, items: [] },
      away: { order: away, items: [] },
    },
  }
}

type Ledger = Awaited<ReturnType<typeof storedLedger>>

const listOf = (
  overrides: Partial<PurchaseOrderListCriteria> = {},
): PurchaseOrderListCriteria => ({
  reach: EVERY_SALON,
  limit: 20,
  after: null,
  salonId: null,
  status: null,
  supplier: null,
  startDate: null,
  endDate: null,
  ...overrides,
})

describe('PurchaseOrderRepository.list', () => {
  it('should list the orders of the salon with their items, the latest and then the greatest ID first', async () => {
    // Arrange
    const { salonId, orders } = await storedLedger()

    // Act
    const listed = await repository().list(listOf({ reach: reachOf(salonId) }))

    // Assert
    expect(listed).toEqual({
      type: 'success',
      data: {
        type: 'listed',
        orders: [
          orders.ordered,
          orders.sameMomentFirst,
          orders.sameMomentLater,
          orders.draft,
        ],
        total: 4,
        hasMore: false,
      },
    })
  })

  it.each<
    [
      string,
      (ledger: Ledger) => Partial<PurchaseOrderListCriteria>,
      (orders: Ledger['orders']) => unknown[],
    ]
  >([
    [
      'the salon',
      ({ other }) => ({ salonId: other }),
      (orders) => [orders.away],
    ],
    [
      'the status',
      () => ({ status: 'pending' }),
      (orders) => [orders.sameMomentFirst, orders.sameMomentLater],
    ],
    [
      'the supplier',
      () => ({ supplier: '髪材の店' }),
      (orders) => [orders.ordered],
    ],
    [
      'the first moment, at the milliseconds a response shows',
      () => ({ startDate: '2026-12-03T10:00:00.123Z' }),
      (orders) => [orders.ordered],
    ],
    [
      'the last moment, at the milliseconds a response shows',
      ({ salonId }) => ({
        reach: reachOf(salonId),
        endDate: '2026-12-03T10:00:00.123Z',
      }),
      (orders) => [
        orders.ordered,
        orders.sameMomentFirst,
        orders.sameMomentLater,
        orders.draft,
      ],
    ],
    [
      'a period',
      ({ salonId }) => ({
        salonId,
        startDate: '2026-12-02T10:00:00.000Z',
        endDate: '2026-12-02T10:00:00.000Z',
      }),
      (orders) => [orders.sameMomentFirst, orders.sameMomentLater],
    ],
    ['a status no order has', () => ({ status: 'shipped' }), () => []],
  ])(
    'should list the orders by %s, and count them',
    async (_case, criteriaOf, expectedOf) => {
      // Arrange
      const ledger = await storedLedger()
      const expected = expectedOf(ledger.orders)

      // Act
      const listed = await repository().list(listOf(criteriaOf(ledger)))

      // Assert
      expect(listed).toEqual({
        type: 'success',
        data: {
          type: 'listed',
          orders: expected,
          total: expected.length,
          hasMore: false,
        },
      })
    },
  )

  it('should list a page at a time, from the order after the cursor, among the orders of every salon', async () => {
    // Arrange
    const { orders } = await storedLedger()

    // Act
    const listed = await repository().list(
      listOf({ limit: 2, after: orders.away.order.id }),
    )

    // Assert
    expect(listed).toEqual({
      type: 'success',
      data: {
        type: 'listed',
        orders: [orders.sameMomentFirst, orders.sameMomentLater],
        total: 5,
        hasMore: true,
      },
    })
  })

  it.each<[string, (ledger: Ledger) => string]>([
    [
      'an order of a salon the reader does not reach',
      ({ orders }) => orders.away.order.id,
    ],
    ['an ID that names no order', () => UNKNOWN_ID],
  ])('should list no page after %s', async (_case, cursorOf) => {
    // Arrange
    const ledger = await storedLedger()

    // Act
    const listed = await repository().list(
      listOf({
        reach: reachOf(ledger.salonId),
        after: purchaseOrderIdSchema.parse(cursorOf(ledger)),
      }),
    )

    // Assert
    expect(listed).toEqual({
      type: 'success',
      data: { type: 'cursorNotFound' },
    })
  })
})

type Change = 'update' | 'approve' | 'cancel'

/** Each change of the status, of a note, by a member of the staff, for a reason. */
const CHANGE: Record<
  Change,
  (
    reach: LedgerReach,
    id: PurchaseOrderId,
  ) => ReturnType<PurchaseOrderRepository['update']>
> = {
  update: (reach, id) => repository().update(reach, id, { notes: '急ぎ' }),
  approve: (reach, id) => repository().approve(reach, id, RECEIVER),
  cancel: (reach, id) => repository().cancel(reach, id, '仕入れ先の欠品'),
}

const changeOf = (change: Change, reach: LedgerReach, id: string) =>
  CHANGE[change](reach, purchaseOrderIdSchema.parse(id))

describe('PurchaseOrderRepository.update', () => {
  it('should write the changes with the time of the change, and answer with the items', async () => {
    // Arrange
    const salonId = await storedSalon()
    const order = await storedOrder(salonId, {
      updatedAt: '2020-01-01T00:00:00Z',
    })
    const item = await storedItem(order.id, null)
    const changes: DbPurchaseOrderChanges = {
      status: 'pending',
      notes: '急ぎ',
      deliveryNotes: '裏口へ',
    }

    // Act
    const updated = await repository().update(
      reachOf(salonId),
      order.id,
      changes,
    )

    // Assert
    const stored = await storedOf(order.id)
    expect(stored).toMatchObject(changes)
    expect(stored?.updatedAt).not.toBe(order.updatedAt)
    expect(updated).toEqual({
      type: 'success',
      data: { type: 'changed', order: { order: stored, items: [item] } },
    })
  })

  it.each<
    [
      string,
      Parameters<typeof insertPurchaseOrder>[2],
      'pending' | 'shipped',
      unknown,
    ]
  >([
    [
      'an order that is delivered',
      DELIVERED,
      'pending',
      { type: 'closed', status: 'delivered' },
    ],
    [
      'a status the order does not go on to',
      {},
      'shipped',
      { type: 'notFromStatus', status: 'draft' },
    ],
  ])(
    'should change nothing of %s',
    async (_case, overrides, status, refusal) => {
      // Arrange
      const salonId = await storedSalon()
      const order = await storedOrder(salonId, overrides)

      // Act
      const updated = await repository().update(reachOf(salonId), order.id, {
        status,
      })

      // Assert
      expect(updated).toEqual({ type: 'success', data: refusal })
      expect(await storedOf(order.id)).toEqual(order)
    },
  )
})

describe('PurchaseOrderRepository.approve', () => {
  it('should approve the pending order, at the time of the change', async () => {
    // Arrange
    const salonId = await storedSalon()
    const order = await storedOrder(salonId, PENDING)

    // Act
    const approved = await repository().approve(
      reachOf(salonId),
      order.id,
      RECEIVER,
    )

    // Assert
    const stored = await storedOf(order.id)
    expect(stored).toMatchObject({ status: 'approved', approvedBy: RECEIVER })
    expect(stored?.approvedAt).toBe(stored?.updatedAt)
    expect(approved).toEqual({
      type: 'success',
      data: { type: 'changed', order: { order: stored, items: [] } },
    })
  })

  it('should approve no draft', async () => {
    // Arrange
    const salonId = await storedSalon()
    const order = await storedOrder(salonId)

    // Act
    const approved = await repository().approve(
      reachOf(salonId),
      order.id,
      RECEIVER,
    )

    // Assert
    expect(approved).toEqual({
      type: 'success',
      data: { type: 'notFromStatus', status: 'draft' },
    })
  })
})

describe('PurchaseOrderRepository.cancel', () => {
  it('should cancel the order with the reason, at the time of the change', async () => {
    // Arrange
    const salonId = await storedSalon()
    const order = await storedOrder(salonId, ORDERED)

    // Act
    const cancelled = await repository().cancel(
      reachOf(salonId),
      order.id,
      '仕入れ先の欠品',
    )

    // Assert
    const stored = await storedOf(order.id)
    expect(stored).toMatchObject({
      status: 'cancelled',
      cancellationReason: '仕入れ先の欠品',
    })
    expect(stored?.cancelledAt).toBe(stored?.updatedAt)
    expect(cancelled).toEqual({
      type: 'success',
      data: { type: 'changed', order: { order: stored, items: [] } },
    })
  })

  it('should cancel no order that is cancelled already', async () => {
    // Arrange
    const salonId = await storedSalon()
    const order = await storedOrder(salonId, CANCELLED)

    // Act
    const cancelled = await repository().cancel(
      reachOf(salonId),
      order.id,
      '二度目',
    )

    // Assert
    expect(cancelled).toEqual({
      type: 'success',
      data: { type: 'closed', status: 'cancelled' },
    })
    expect(await storedOf(order.id)).toEqual(order)
  })
})

describe('PurchaseOrderRepository changes of the status', () => {
  const CHANGES: Change[] = ['update', 'approve', 'cancel']

  it.each(
    CHANGES.flatMap((change): [Change, string, () => Promise<string>][] => [
      [
        change,
        'order of another salon',
        async () => (await storedOrder(await storedSalon(), PENDING)).id,
      ],
      [change, 'order of an ID that names none', async () => UNKNOWN_ID],
    ]),
  )('should %s no %s', async (change, _target, idOfOrder) => {
    // Arrange
    const salonId = await storedSalon()
    const id = await idOfOrder()

    // Act
    const changed = await changeOf(change, reachOf(salonId), id)

    // Assert
    expect(changed).toEqual({ type: 'success', data: { type: 'notFound' } })
  })

  it.each(CHANGES)(
    'should %s on the status the cancellation it waited for left',
    async (change) => {
      // Arrange
      const salonId = await storedSalon()
      const order = await storedOrder(salonId, PENDING)

      // Act
      const changed = await databases.whileHeld(
        (held) =>
          held`select id from purchase_orders where id = ${order.id} for update`,
        (held) =>
          held`update purchase_orders set status = 'cancelled', "cancelledAt" = now(), "cancellationReason" = '先に取り消し' where id = ${order.id}`,
        () => changeOf(change, reachOf(salonId), order.id),
      )

      // Assert
      expect(changed).toEqual({
        type: 'success',
        data: { type: 'closed', status: 'cancelled' },
      })
    },
  )

  it.each<[Change, string]>([
    ['update', 'Update of purchase order returned no row'],
    ['approve', 'Update of approved purchase order returned no row'],
    ['cancel', 'Update of cancelled purchase order returned no row'],
  ])(
    'should answer that the %s returned no row when a trigger skips it',
    async (change, message) => {
      // Arrange
      const salonId = await storedSalon()
      const order = await storedOrder(salonId, PENDING)
      await databases.skipWrites('purchase_orders', 'UPDATE')

      // Act
      const changed = await changeOf(change, reachOf(salonId), order.id)

      // Assert
      expect(changed).toEqual(failureOf(message))
    },
  )
})

/**
 * An order of a salon that is ordered, with an item of 10 of a row that
 * holds 3, 1 of it reserved, at 100 yen, and an item of 4 of an empty row
 * at 250 yen. The IDs of the rows are in another order than the items.
 */
const storedDelivery = async (
  overrides: Parameters<typeof insertPurchaseOrder>[2] = ORDERED,
) => {
  const salonId = await storedSalon()
  const shampoo = await storedRow(
    salonId,
    {},
    {
      id: idOf(52),
      currentStock: '3.00',
      reservedStock: '1.00',
      availableStock: '2.00',
      lotNumber: null,
      expiryDate: '2027-05-31',
    },
  )
  const towels = await storedRow(
    salonId,
    {},
    { id: idOf(51), currentStock: '0.00', availableStock: '0.00' },
  )
  const order = await storedOrder(salonId, {
    ...overrides,
    deliveryNotes: 'もとのメモ',
  })
  const items = [
    await storedItem(order.id, shampoo.id, {
      quantity: '10.00',
      unitPrice: 100,
      totalPrice: 1000,
      sortOrder: 0,
    }),
    await storedItem(order.id, towels.id, {
      quantity: '4.00',
      unitPrice: 250,
      totalPrice: 1000,
      sortOrder: 1,
    }),
  ]
  return { salonId, order, items, rows: { shampoo, towels } }
}

const receiptOf = (
  items: PurchaseOrderReceiptCriteria['items'],
  deliveryNotes: string | null = '箱が 1 つ潰れていた',
): PurchaseOrderReceiptCriteria => ({
  items,
  deliveryNotes,
  performedBy: RECEIVER,
})

describe('PurchaseOrderRepository.receive', () => {
  it('should take what arrived into the rows as purchases, and deliver the order at one moment', async () => {
    // Arrange
    const { salonId, order, items, rows } = await storedDelivery()

    // Act
    const received = await repository().receive(
      reachOf(salonId),
      order.id,
      receiptOf([
        { inventoryId: rows.towels.id, quantity: 4 },
        { inventoryId: rows.shampoo.id, quantity: 6 },
      ]),
    )

    // Assert
    const stored = await storedOf(order.id)
    expect(stored).toMatchObject({
      status: 'delivered',
      deliveryNotes: '箱が 1 つ潰れていた',
    })
    expect(stored?.actualDelivery).toBe(stored?.updatedAt)
    expect(received).toEqual({
      type: 'success',
      data: { type: 'received', order: { order: stored, items } },
    })
    const purchase = {
      transactionType: 'purchase',
      referenceType: 'purchase_order',
      referenceId: order.id,
      reason: null,
      performedBy: RECEIVER,
      salonId,
      createdAt: stored?.updatedAt,
    }
    expect(await rowOf(rows.shampoo.id)).toMatchObject({
      currentStock: '9.00',
      availableStock: '8.00',
      reservedStock: '1.00',
      updatedAt: stored?.updatedAt,
    })
    expect(await movementsOf(rows.shampoo.id)).toMatchObject([
      {
        ...purchase,
        productId: rows.shampoo.productId,
        lotNumber: null,
        expiryDate: '2027-05-31',
        quantity: '6.00',
        unitCost: 100,
        totalCost: 600,
        balanceBefore: '3.00',
        balanceAfter: '9.00',
      },
    ])
    expect(await rowOf(rows.towels.id)).toMatchObject({
      currentStock: '4.00',
      availableStock: '4.00',
    })
    expect(await movementsOf(rows.towels.id)).toMatchObject([
      {
        ...purchase,
        productId: rows.towels.productId,
        quantity: '4.00',
        unitCost: 250,
        totalCost: 1000,
        balanceBefore: '0.00',
        balanceAfter: '4.00',
      },
    ])
  })

  it('should keep the delivery notes of the order when the receipt has none', async () => {
    // Arrange
    const { salonId, order, rows } = await storedDelivery()

    // Act
    const received = await repository().receive(
      reachOf(salonId),
      order.id,
      receiptOf([{ inventoryId: rows.towels.id, quantity: 4 }], null),
    )

    // Assert
    expect(received).toMatchObject({
      type: 'success',
      data: {
        type: 'received',
        order: { order: { deliveryNotes: 'もとのメモ' } },
      },
    })
  })

  it.each<[string, Parameters<typeof insertPurchaseOrder>[2], unknown]>([
    [
      'an order that is delivered',
      DELIVERED,
      { type: 'closed', status: 'delivered' },
    ],
    [
      'an order that is not ordered yet',
      PENDING,
      { type: 'notFromStatus', status: 'pending' },
    ],
  ])('should receive nothing of %s', async (_case, overrides, refusal) => {
    // Arrange
    const { salonId, order, rows } = await storedDelivery(overrides)

    // Act
    const received = await repository().receive(
      reachOf(salonId),
      order.id,
      receiptOf([{ inventoryId: rows.towels.id, quantity: 4 }]),
    )

    // Assert
    expect(received).toEqual({ type: 'success', data: refusal })
    expect(await rowOf(rows.towels.id)).toEqual(rows.towels)
  })

  it.each<[string, () => Promise<string>]>([
    ['order of another salon', async () => (await storedDelivery()).order.id],
    ['order of an ID that names none', async () => UNKNOWN_ID],
  ])('should receive no %s', async (_case, idOfOrder) => {
    // Arrange
    const salonId = await storedSalon()

    // Act
    const received = await repository().receive(
      reachOf(salonId),
      purchaseOrderIdSchema.parse(await idOfOrder()),
      receiptOf([]),
    )

    // Assert
    expect(received).toEqual({ type: 'success', data: { type: 'notFound' } })
  })

  it('should take nothing of a receipt of more than an item orders, or of a row only another order has an item for', async () => {
    // Arrange
    const { salonId, order, rows } = await storedDelivery()
    const other = await storedRow(salonId)
    await storedItem((await storedOrder(salonId, ORDERED)).id, other.id)

    // Act
    const received = await repository().receive(
      reachOf(salonId),
      order.id,
      receiptOf([
        { inventoryId: rows.towels.id, quantity: 4.01 },
        { inventoryId: other.id, quantity: 1 },
      ]),
    )

    // Assert
    expect(received).toEqual({
      type: 'success',
      data: {
        type: 'itemsRefused',
        refusals: [
          { type: 'moreThanOrdered', index: 0, ordered: 4 },
          { type: 'notOrdered', index: 1 },
        ],
      },
    })
    expect((await storedOf(order.id))?.status).toBe('ordered')
  })

  it('should take nothing into a row above the most it holds', async () => {
    // Arrange
    const { salonId, order, rows } = await storedDelivery()
    await databases
      .database()
      .update(inventory)
      .set({ currentStock: '99999996.00', availableStock: '99999996.00' })
      .where(eq(inventory.id, rows.towels.id))

    // Act
    const received = await repository().receive(
      reachOf(salonId),
      order.id,
      receiptOf([
        { inventoryId: rows.shampoo.id, quantity: 6 },
        { inventoryId: rows.towels.id, quantity: 4 },
      ]),
    )

    // Assert
    expect(received).toEqual({
      type: 'success',
      data: { type: 'overLimit', inventoryId: rows.towels.id },
    })
    expect(await movementsOf(rows.shampoo.id)).toEqual([])
  })

  it('should take nothing of the item of a row that the deletion it waited for took away', async () => {
    // Arrange
    const { salonId, order, rows } = await storedDelivery()

    // Act
    const received = await databases.whileHeld(
      (held) =>
        held`select id from inventory where id = ${rows.towels.id} for update`,
      (held) => held`delete from inventory where id = ${rows.towels.id}`,
      () =>
        repository().receive(
          reachOf(salonId),
          order.id,
          receiptOf([
            { inventoryId: rows.shampoo.id, quantity: 6 },
            { inventoryId: rows.towels.id, quantity: 4 },
          ]),
        ),
    )

    // Assert
    expect(received).toEqual({
      type: 'success',
      data: {
        type: 'itemsRefused',
        refusals: [{ type: 'notOrdered', index: 1 }],
      },
    })
  })

  it('should take what arrived into the stock the movement it waited for left', async () => {
    // Arrange
    const { salonId, order, rows } = await storedDelivery()

    // Act
    const received = await databases.whileHeld(
      (held) =>
        held`select id from inventory where id = ${rows.shampoo.id} for update`,
      (held) =>
        held`update inventory set "currentStock" = 5, "availableStock" = 4 where id = ${rows.shampoo.id}`,
      () =>
        repository().receive(
          reachOf(salonId),
          order.id,
          receiptOf([{ inventoryId: rows.shampoo.id, quantity: 6 }]),
        ),
    )

    // Assert
    expect(received).toMatchObject({
      type: 'success',
      data: { type: 'received' },
    })
    expect(await movementsOf(rows.shampoo.id)).toMatchObject([
      { balanceBefore: '5.00', balanceAfter: '11.00' },
    ])
  })

  it('should receive nothing of an order that the cancellation it waited for closed', async () => {
    // Arrange
    const { salonId, order, rows } = await storedDelivery()

    // Act
    const received = await databases.whileHeld(
      (held) =>
        held`select id from purchase_orders where id = ${order.id} for update`,
      (held) =>
        held`update purchase_orders set status = 'cancelled', "cancelledAt" = now(), "cancellationReason" = '先に取り消し' where id = ${order.id}`,
      () =>
        repository().receive(
          reachOf(salonId),
          order.id,
          receiptOf([{ inventoryId: rows.towels.id, quantity: 4 }]),
        ),
    )

    // Assert
    expect(received).toEqual({
      type: 'success',
      data: { type: 'closed', status: 'cancelled' },
    })
  })

  it.each<[string, string, 'UPDATE' | 'INSERT', string]>([
    [
      'the delivery of the order',
      'purchase_orders',
      'UPDATE',
      'Update of delivered purchase order returned no row',
    ],
    [
      'the update of the rows',
      'inventory',
      'UPDATE',
      'Update of received stock rows returned no row for 2 of 2',
    ],
    [
      'the insert of the purchases',
      'inventory_transactions',
      'INSERT',
      'Insert of purchases returned no row for 2 of 2',
    ],
  ])(
    'should answer that %s returned no row when a trigger skips it',
    async (_case, table, operation, message) => {
      // Arrange
      const { salonId, order, rows } = await storedDelivery()
      await databases.skipWrites(table, operation)

      // Act
      const received = await repository().receive(
        reachOf(salonId),
        order.id,
        receiptOf([
          { inventoryId: rows.shampoo.id, quantity: 6 },
          { inventoryId: rows.towels.id, quantity: 4 },
        ]),
      )

      // Assert
      expect(received).toEqual(failureOf(message))
    },
  )
})

/**
 * The products of a salon, by code: A-100 holds 3 and 1 with 2 on an open
 * order (suggested 20 less 6), the latest order of it that was not called
 * off on 2026-12-01; B-200 holds 3 and has no reorder point or maximum
 * (suggested its minimum of 5 less 3); C-300 holds as much as its reorder
 * point (suggested 10 less 8). Not suggested: D-400, which holds its
 * maximum, E-500 that is not used any more, F-600 that is deleted, G-700
 * that has no stock row, and a product of another salon.
 */
const storedReorders = async () => {
  const salonId = await storedSalon()
  const other = await storedSalon()
  const db = databases.database()
  const product = async (
    overrides: Parameters<typeof insertProduct>[2],
    stocks: string[],
    salon: SalonId = salonId,
  ) => {
    const stored = await insertProduct(db, salon, {
      requiresLotTracking: true,
      ...overrides,
    })
    const rows = []
    for (const [index, amount] of stocks.entries()) {
      rows.push(
        await insertStock(db, salon, stored.id, {
          lotNumber: `L-${index}`,
          currentStock: amount,
          availableStock: amount,
        }),
      )
    }
    return { ...stored, id: productIdSchema.parse(stored.id), rows }
  }
  const levels = {
    minimumStock: '5.00',
    reorderPoint: '8.00',
    maximumStock: '20.00',
  }
  const low = await product(
    { ...levels, productCode: 'A-100', supplier: '櫛商事' },
    ['3.00', '1.00'],
  )
  const bare = await product({ productCode: 'B-200', minimumStock: '5.00' }, [
    '3.00',
  ])
  const atPoint = await product(
    { ...levels, productCode: 'C-300', maximumStock: '10.00' },
    ['8.00'],
  )
  await product(
    {
      ...levels,
      productCode: 'D-400',
      reorderPoint: '5.00',
      maximumStock: '5.00',
    },
    ['5.00'],
  )
  await product({ ...levels, productCode: 'E-500', isActive: false }, ['0.00'])
  await product(
    { ...levels, productCode: 'F-600', deletedAt: '2026-12-01T00:00:00Z' },
    ['0.00'],
  )
  await product({ ...levels, productCode: 'G-700' }, [])
  const elsewhere = await product(
    { ...levels, productCode: 'A-100' },
    ['0.00'],
    other,
  )

  const [lowRow] = low.rows
  const lowRowId = lowRow?.id ?? UNKNOWN_ID
  const open = await storedOrder(salonId, {
    ...ORDERED,
    orderDate: '2026-12-01T10:00:00Z',
  })
  await storedItem(open.id, lowRowId, { quantity: '2.00', totalPrice: 200 })
  const delivered = await storedOrder(salonId, {
    ...DELIVERED,
    orderDate: '2026-11-01T10:00:00Z',
  })
  await storedItem(delivered.id, lowRowId, {
    quantity: '9.00',
    totalPrice: 900,
  })
  const cancelled = await storedOrder(salonId, {
    ...CANCELLED,
    orderDate: '2026-12-05T10:00:00Z',
  })
  await storedItem(cancelled.id, lowRowId, {
    quantity: '9.00',
    totalPrice: 900,
  })
  const elsewhereOrder = await storedOrder(other, ORDERED)
  await storedItem(elsewhereOrder.id, elsewhere.rows[0]?.id ?? null, {
    quantity: '9.00',
    totalPrice: 900,
  })

  const suggestionOf = (
    stored: typeof low,
    values: {
      currentStock: string
      onOrderQuantity: string
      reorderPoint: string
      suggestedQuantity: string
      lastOrderDate: string | null
    },
  ) => ({
    productId: stored.id,
    productCode: stored.productCode,
    productName: stored.name,
    unit: stored.unit,
    supplier: stored.supplier,
    maximumStock: stored.maximumStock,
    ...values,
  })
  return {
    salonId,
    other,
    elsewhere,
    suggestions: {
      low: suggestionOf(low, {
        currentStock: '4.00',
        onOrderQuantity: '2.00',
        reorderPoint: '8.00',
        suggestedQuantity: '14.00',
        lastOrderDate: open.orderDate,
      }),
      bare: suggestionOf(bare, {
        currentStock: '3.00',
        onOrderQuantity: '0',
        reorderPoint: '5.00',
        suggestedQuantity: '2.00',
        lastOrderDate: null,
      }),
      atPoint: suggestionOf(atPoint, {
        currentStock: '8.00',
        onOrderQuantity: '0',
        reorderPoint: '8.00',
        suggestedQuantity: '2.00',
        lastOrderDate: null,
      }),
    },
  }
}

describe('PurchaseOrderRepository.listReorderSuggestions', () => {
  it('should suggest the active products of the salon whose stock and what is on order are at most their reorder point, by product code', async () => {
    // Arrange
    const { salonId, suggestions } = await storedReorders()

    // Act
    const listed = await repository().listReorderSuggestions({
      salonId,
      limit: 20,
      after: null,
    })

    // Assert
    expect(listed).toEqual({
      type: 'success',
      data: {
        type: 'listed',
        suggestions: [suggestions.low, suggestions.bare, suggestions.atPoint],
        total: 3,
        hasMore: false,
      },
    })
  })

  it('should list a page at a time, from the product after the cursor', async () => {
    // Arrange
    const { salonId, suggestions } = await storedReorders()

    // Act
    const listed = await repository().listReorderSuggestions({
      salonId,
      limit: 1,
      after: productIdSchema.parse(suggestions.low.productId),
    })

    // Assert
    expect(listed).toEqual({
      type: 'success',
      data: {
        type: 'listed',
        suggestions: [suggestions.bare],
        total: 3,
        hasMore: true,
      },
    })
  })

  it.each<
    [string, (reorders: Awaited<ReturnType<typeof storedReorders>>) => string]
  >([
    ['a product of another salon', ({ elsewhere }) => elsewhere.id],
    ['an ID that names no product', () => UNKNOWN_ID],
  ])('should list no page after %s', async (_case, cursorOf) => {
    // Arrange
    const reorders = await storedReorders()

    // Act
    const listed = await repository().listReorderSuggestions({
      salonId: reorders.salonId,
      limit: 20,
      after: productIdSchema.parse(cursorOf(reorders)),
    })

    // Assert
    expect(listed).toEqual({
      type: 'success',
      data: { type: 'cursorNotFound' },
    })
  })
})

describe('PurchaseOrderRepository when the database is gone', () => {
  const salonId = salonIdSchema.parse(UNKNOWN_ID)
  const id = purchaseOrderIdSchema.parse(UNKNOWN_ID)
  const reach = reachOf(salonId)

  it.each<[string, (gone: PurchaseOrderRepository) => Promise<unknown>]>([
    [
      'Failed to create purchase order',
      (gone) =>
        gone.create({
          order: orderOf(salonId),
          items: [itemOf(inventoryIdSchema.parse(UNKNOWN_ID))],
          orderNumber: 'PO-2026-0001',
        }),
    ],
    ['Failed to find purchase order', (gone) => gone.findById(reach, id)],
    ['Failed to list purchase orders', (gone) => gone.list(listOf())],
    [
      'Failed to update purchase order',
      (gone) => gone.update(reach, id, { notes: null }),
    ],
    [
      'Failed to approve purchase order',
      (gone) => gone.approve(reach, id, null),
    ],
    [
      'Failed to cancel purchase order',
      (gone) => gone.cancel(reach, id, '取り消し'),
    ],
    [
      'Failed to receive purchase order',
      (gone) => gone.receive(reach, id, receiptOf([])),
    ],
    [
      'Failed to list reorder suggestions',
      (gone) =>
        gone.listReorderSuggestions({ salonId, limit: 20, after: null }),
    ],
  ])('should answer %s', async (message, call) => {
    // Arrange
    const gone = new PurchaseOrderRepository(await databases.gone())

    // Act
    const answered = await call(gone)

    // Assert
    expect(answered).toMatchObject({
      type: 'error',
      error: { type: 'database', message },
    })
  })
})
