import {
  inventory,
  products,
  purchaseOrderItems,
  purchaseOrders,
} from '@beauty-salon-backend/database'
import {
  type DbPurchaseOrder,
  type DbPurchaseOrderChanges,
  type DbPurchaseOrderItem,
  type DomainError,
  type IPurchaseOrderRepository,
  type LedgerReach,
  type OrderStatusRefusal,
  type PurchaseOrderChange,
  type PurchaseOrderCreateCriteria,
  type PurchaseOrderCreation,
  type PurchaseOrderId,
  type PurchaseOrderListCriteria,
  type PurchaseOrderListing,
  type PurchaseOrderWithItems,
  refusalOfApproval,
  refusalOfCancellation,
  refusalOfUpdate,
  type StaffId,
} from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { and, asc, count, desc, eq, inArray, type SQL, sql } from 'drizzle-orm'
import type {
  PgTransactionConfig,
  PgUpdateSetSource,
} from 'drizzle-orm/pg-core'
import { match } from 'ts-pattern'
import { attempt } from '../database/attempt'
import type { Database, DatabaseExecutor } from '../database/index'

/** The orders of the salons the reach covers. */
const within = (reach: LedgerReach): SQL | undefined =>
  match(reach)
    .with({ type: 'everySalon' }, () => undefined)
    .with({ type: 'salon' }, ({ salonId }) =>
      eq(purchaseOrders.salonId, salonId),
    )
    .exhaustive()

const AT_ONE_MOMENT: PgTransactionConfig = {
  isolationLevel: 'repeatable read',
  accessMode: 'read only',
}

/**
 * The date of an order as a response shows it, to the millisecond: a
 * filter by the date a client was shown matches the order it was shown.
 */
const orderedAt = sql`date_trunc('milliseconds', ${purchaseOrders.orderDate})`

/**
 * The moment of a change: when its write begins, once the order is held.
 * The time of the approval or of the cancellation and that of the change
 * are one.
 */
const CHANGED_AT = sql`statement_timestamp()`

/** The items of the orders by the order, each in the order of the request. */
const itemsOf = async (
  executor: DatabaseExecutor,
  orderIds: string[],
): Promise<Map<string, DbPurchaseOrderItem[]>> => {
  const rows =
    orderIds.length === 0
      ? []
      : await executor
          .select()
          .from(purchaseOrderItems)
          .where(inArray(purchaseOrderItems.purchaseOrderId, orderIds))
          .orderBy(
            asc(purchaseOrderItems.purchaseOrderId),
            asc(purchaseOrderItems.sortOrder),
          )
  const byOrder = new Map<string, DbPurchaseOrderItem[]>()
  for (const row of rows) {
    byOrder.set(row.purchaseOrderId, [
      ...(byOrder.get(row.purchaseOrderId) ?? []),
      row,
    ])
  }
  return byOrder
}

/** The order with its items, if the reach covers it. */
const orderOf = async (
  executor: DatabaseExecutor,
  id: PurchaseOrderId,
  reach: LedgerReach,
): Promise<PurchaseOrderWithItems | null> => {
  const [order] = await executor
    .select()
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.id, id), within(reach)))
  if (order === undefined) {
    return null
  }
  const items = await itemsOf(executor, [order.id])

  return { order, items: items.get(order.id) ?? [] }
}

export class PurchaseOrderRepository implements IPurchaseOrderRepository {
  constructor(private readonly db: Database) {}

  async create({
    order,
    items,
    orderNumber,
  }: PurchaseOrderCreateCriteria): Promise<
    Result<PurchaseOrderCreation, DomainError>
  > {
    return attempt('Failed to create purchase order', () =>
      this.db.transaction(
        async (tx): Promise<PurchaseOrderCreation> => {
          // The stock rows of the salon the items name, with what is copied
          // of their products. The locks are those a removal of a row and a
          // change of a product wait for and are waited for by: a row that
          // is being removed is gone by the time this statement returns,
          // and a product that is being changed is read as it is once
          // changed. A product with stock rows is not deleted.
          const rows = await tx
            .select({
              id: inventory.id,
              productCode: products.productCode,
              productName: products.name,
              unit: products.unit,
            })
            .from(inventory)
            .innerJoin(products, eq(products.id, inventory.productId))
            .where(
              and(
                inArray(
                  inventory.id,
                  items.map(({ inventoryId }) => inventoryId),
                ),
                eq(inventory.salonId, order.salonId),
              ),
            )
            .orderBy(asc(inventory.id))
            .for('key share')
          const byId = new Map(rows.map((row) => [row.id, row]))
          const ordered = items.map((item) => ({
            item,
            row: byId.get(item.inventoryId),
          }))
          const indexes = ordered.flatMap(({ row }, index) =>
            row === undefined ? [index] : [],
          )
          if (indexes.length > 0) {
            return { type: 'rowsNotFound', indexes }
          }

          const [stored] = await tx
            .insert(purchaseOrders)
            .values({ ...order, orderNumber })
            .onConflictDoNothing({ target: purchaseOrders.orderNumber })
            .returning()
          if (stored === undefined) {
            return { type: 'orderNumberTaken' }
          }
          const storedItems = await tx
            .insert(purchaseOrderItems)
            .values(
              ordered.flatMap(({ item, row }, sortOrder) =>
                row === undefined
                  ? []
                  : [
                      {
                        ...item,
                        purchaseOrderId: stored.id,
                        productCode: row.productCode,
                        productName: row.productName,
                        unit: row.unit,
                        sortOrder,
                      },
                    ],
              ),
            )
            .returning()

          return {
            type: 'created',
            order: {
              order: stored,
              items: storedItems.toSorted(
                (left, right) => left.sortOrder - right.sortOrder,
              ),
            },
          }
        },
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async findById(
    reach: LedgerReach,
    id: PurchaseOrderId,
  ): Promise<Result<PurchaseOrderWithItems | null, DomainError>> {
    return attempt('Failed to find purchase order', () =>
      this.db.transaction((tx) => orderOf(tx, id, reach), AT_ONE_MOMENT),
    )
  }

  async list({
    reach,
    limit,
    after,
    salonId,
    status,
    supplier,
    startDate,
    endDate,
  }: PurchaseOrderListCriteria): Promise<
    Result<PurchaseOrderListing, DomainError>
  > {
    const filters = and(
      within(reach),
      salonId === null ? undefined : eq(purchaseOrders.salonId, salonId),
      status === null ? undefined : eq(purchaseOrders.status, status),
      supplier === null ? undefined : eq(purchaseOrders.supplier, supplier),
      startDate === null
        ? undefined
        : sql`${orderedAt} >= ${startDate}::timestamptz`,
      endDate === null
        ? undefined
        : sql`${orderedAt} <= ${endDate}::timestamptz`,
    )

    return attempt('Failed to list purchase orders', () =>
      this.db.transaction(async (tx): Promise<PurchaseOrderListing> => {
        // Keyset pagination on (orderDate, id), downwards: the page starts
        // after the order the cursor names, which has to be one the reach
        // covers.
        const [cursor] =
          after === null
            ? []
            : await tx
                .select({ orderDate: purchaseOrders.orderDate })
                .from(purchaseOrders)
                .where(and(eq(purchaseOrders.id, after), within(reach)))
        if (after !== null && cursor === undefined) {
          return { type: 'cursorNotFound' }
        }
        const afterCursor =
          after === null || cursor === undefined
            ? undefined
            : sql`(${purchaseOrders.orderDate}, ${purchaseOrders.id}) < (${cursor.orderDate}::timestamptz, ${after}::uuid)`

        const found = await tx
          .select()
          .from(purchaseOrders)
          .where(and(filters, afterCursor))
          .orderBy(desc(purchaseOrders.orderDate), desc(purchaseOrders.id))
          // One extra order tells whether another page follows.
          .limit(limit + 1)
        const page = found.slice(0, limit)
        const items = await itemsOf(
          tx,
          page.map(({ id }) => id),
        )
        const [matching] = await tx
          .select({ total: count() })
          .from(purchaseOrders)
          .where(filters)

        return {
          type: 'listed',
          orders: page.map((order) => ({
            order,
            items: items.get(order.id) ?? [],
          })),
          total: matching?.total ?? 0,
          hasMore: found.length > limit,
        }
      }, AT_ONE_MOMENT),
    )
  }

  async update(
    reach: LedgerReach,
    id: PurchaseOrderId,
    changes: DbPurchaseOrderChanges,
  ): Promise<Result<PurchaseOrderChange, DomainError>> {
    return this.change(
      'Failed to update purchase order',
      reach,
      id,
      (status) => refusalOfUpdate(status, changes.status),
      changes,
    )
  }

  async approve(
    reach: LedgerReach,
    id: PurchaseOrderId,
    approvedBy: StaffId | null,
  ): Promise<Result<PurchaseOrderChange, DomainError>> {
    return this.change(
      'Failed to approve purchase order',
      reach,
      id,
      refusalOfApproval,
      { status: 'approved', approvedBy, approvedAt: CHANGED_AT },
    )
  }

  async cancel(
    reach: LedgerReach,
    id: PurchaseOrderId,
    cancellationReason: string,
  ): Promise<Result<PurchaseOrderChange, DomainError>> {
    return this.change(
      'Failed to cancel purchase order',
      reach,
      id,
      refusalOfCancellation,
      { status: 'cancelled', cancelledAt: CHANGED_AT, cancellationReason },
    )
  }

  /**
   * Holds the order and writes the values with the time of the change,
   * unless where the order stands refuses it. Two changes of one order take
   * turns, and the second is decided on what the first left.
   */
  private async change(
    message: string,
    reach: LedgerReach,
    id: PurchaseOrderId,
    refusalOf: (status: DbPurchaseOrder['status']) => OrderStatusRefusal | null,
    values: PgUpdateSetSource<typeof purchaseOrders>,
  ): Promise<Result<PurchaseOrderChange, DomainError>> {
    return attempt(message, () =>
      this.db.transaction(
        async (tx): Promise<PurchaseOrderChange> => {
          const [held] = await tx
            .select({ status: purchaseOrders.status })
            .from(purchaseOrders)
            .where(and(eq(purchaseOrders.id, id), within(reach)))
            .for('update')
          if (held === undefined) {
            return { type: 'notFound' }
          }
          const refusal = refusalOf(held.status)
          if (refusal !== null) {
            return refusal
          }

          await tx
            .update(purchaseOrders)
            .set({ ...values, updatedAt: CHANGED_AT })
            .where(eq(purchaseOrders.id, id))
          const order = await orderOf(tx, id, reach)

          return order === null
            ? { type: 'notFound' }
            : { type: 'changed', order }
        },
        { isolationLevel: 'read committed' },
      ),
    )
  }
}
