import {
  inventory,
  inventoryTransactions,
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
  type PurchaseOrderReceipt,
  type PurchaseOrderReceiptCriteria,
  type PurchaseOrderWithItems,
  planGoodsReceipt,
  type ReorderSuggestionCriteria,
  type ReorderSuggestionListing,
  refusalOfApproval,
  refusalOfCancellation,
  refusalOfGoodsReceipt,
  refusalOfUpdate,
  type StaffId,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  notInArray,
  type SQL,
  sql,
} from 'drizzle-orm'
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core'
import { match } from 'ts-pattern'
import { attempt } from '../database/attempt'
import { totalOf } from '../database/count'
import type { Database, DatabaseExecutor } from '../database/index'
import { AT_ONE_MOMENT } from '../database/snapshot'
import { rowWritten, writtenFor } from '../database/written'

/** The orders of the salons the reach covers. */
const within = (reach: LedgerReach): SQL | undefined =>
  match(reach)
    .with({ type: 'everySalon' }, () => undefined)
    .with({ type: 'salon' }, ({ salonId }) =>
      eq(purchaseOrders.salonId, salonId),
    )
    .exhaustive()

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

/** The most a stock row holds, as its `numeric(10, 2)` column does. */
const MAX_STOCK = sql`99999999.99`

/** The statuses of an order that is closed: nothing of it changes, and it brings nothing more. */
const CLOSED: DbPurchaseOrder['status'][] = ['delivered', 'cancelled']

/** The kind of the movements a receipt records. */
const PURCHASE: (typeof inventoryTransactions.$inferInsert)['transactionType'] =
  'purchase'

/** What a receipt records of a stock movement that tells where it comes from. */
const PURCHASE_ORDER_REFERENCE = 'purchase_order'

/** The items of the orders, by the order and then in the order of the request. */
const itemsOf = (
  executor: DatabaseExecutor,
  orderIds: string[],
): Promise<DbPurchaseOrderItem[]> =>
  executor
    .select()
    .from(purchaseOrderItems)
    .where(inArray(purchaseOrderItems.purchaseOrderId, orderIds))
    .orderBy(
      asc(purchaseOrderItems.purchaseOrderId),
      asc(purchaseOrderItems.sortOrder),
    )

/** The order, as read or as a write returned it, with its items. */
const withItems = async (
  executor: DatabaseExecutor,
  order: DbPurchaseOrder,
): Promise<PurchaseOrderWithItems> => ({
  order,
  items: await itemsOf(executor, [order.id]),
})

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

  return order === undefined ? null : withItems(executor, order)
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
    const created = await attempt('Failed to create purchase order', () =>
      this.db.transaction(
        async (tx): Promise<Result<PurchaseOrderCreation, DomainError>> => {
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
          // The items with their rows, in the order of the request.
          const found = items.flatMap((item) => {
            const row = byId.get(item.inventoryId)
            return row === undefined ? [] : [{ item, row }]
          })
          if (found.length < items.length) {
            return Result.success({
              type: 'rowsNotFound',
              indexes: items.flatMap(({ inventoryId }, index) =>
                byId.has(inventoryId) ? [] : [index],
              ),
            })
          }

          const [stored] = await tx
            .insert(purchaseOrders)
            .values({ ...order, orderNumber })
            .onConflictDoNothing({ target: purchaseOrders.orderNumber })
            .returning()
          if (stored === undefined) {
            return Result.success({ type: 'orderNumberTaken' })
          }
          const storedItems = writtenFor('Insert of purchase order items')(
            found,
            ({ item }) => item.inventoryId,
            await tx
              .insert(purchaseOrderItems)
              .values(
                found.map(({ item, row }, sortOrder) => ({
                  ...item,
                  purchaseOrderId: stored.id,
                  productCode: row.productCode,
                  productName: row.productName,
                  unit: row.unit,
                  sortOrder,
                })),
              )
              .returning(),
            ({ inventoryId }) => inventoryId,
          )

          return Result.map(
            storedItems,
            (paired): PurchaseOrderCreation => ({
              type: 'created',
              order: { order: stored, items: paired.map(({ row }) => row) },
            }),
          )
        },
        { isolationLevel: 'read committed' },
      ),
    )

    return Result.flatMap(created, (creation) => creation)
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
                .select({
                  orderDate: purchaseOrders.orderDate,
                  id: purchaseOrders.id,
                })
                .from(purchaseOrders)
                .where(and(eq(purchaseOrders.id, after), within(reach)))
        if (after !== null && cursor === undefined) {
          return { type: 'cursorNotFound' }
        }
        const afterCursor =
          cursor === undefined
            ? undefined
            : sql`(${purchaseOrders.orderDate}, ${purchaseOrders.id}) < (${cursor.orderDate}::timestamptz, ${cursor.id}::uuid)`

        const found = await tx
          .select()
          .from(purchaseOrders)
          .where(and(filters, afterCursor))
          .orderBy(desc(purchaseOrders.orderDate), desc(purchaseOrders.id))
          // One extra order tells whether another page follows.
          .limit(limit + 1)
        const page = found.slice(0, limit)
        const items = Map.groupBy(
          await itemsOf(
            tx,
            page.map(({ id }) => id),
          ),
          ({ purchaseOrderId }) => purchaseOrderId,
        )
        const counted = await tx
          .select({ total: count() })
          .from(purchaseOrders)
          .where(filters)

        return {
          type: 'listed',
          orders: page.map((order) => ({
            order,
            items: items.get(order.id) ?? [],
          })),
          total: totalOf(counted),
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
      'Update of purchase order',
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
      'Update of approved purchase order',
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
      'Update of cancelled purchase order',
      reach,
      id,
      refusalOfCancellation,
      { status: 'cancelled', cancelledAt: CHANGED_AT, cancellationReason },
    )
  }

  async receive(
    reach: LedgerReach,
    id: PurchaseOrderId,
    { items, deliveryNotes, performedBy }: PurchaseOrderReceiptCriteria,
  ): Promise<Result<PurchaseOrderReceipt, DomainError>> {
    const received = await attempt('Failed to receive purchase order', () =>
      this.db.transaction(
        async (tx): Promise<Result<PurchaseOrderReceipt, DomainError>> => {
          // Held, the order is received once, and not while it is changed
          // or cancelled; it is decided on as it is once held.
          const [held] = await tx
            .select({ status: purchaseOrders.status })
            .from(purchaseOrders)
            .where(and(eq(purchaseOrders.id, id), within(reach)))
            .for('update')
          if (held === undefined) {
            return Result.success({ type: 'notFound' })
          }
          const refusal = refusalOfGoodsReceipt(held.status)
          if (refusal !== null) {
            return Result.success(refusal)
          }

          const ordered = await tx
            .select({
              inventoryId: purchaseOrderItems.inventoryId,
              quantity: purchaseOrderItems.quantity,
              unitPrice: purchaseOrderItems.unitPrice,
            })
            .from(purchaseOrderItems)
            .where(eq(purchaseOrderItems.purchaseOrderId, id))
          const plan = planGoodsReceipt(ordered, items)
          if (plan.type === 'refused') {
            return Result.success({
              type: 'itemsRefused',
              refusals: plan.refusals,
            })
          }
          const { movements } = plan
          const ids = movements.map(({ inventoryId }) => inventoryId)
          // What arrives of a stock row, as a value of the row.
          const arriving = sql`(case ${inventory.id} ${sql.join(
            movements.map(
              ({ inventoryId, quantity }) =>
                sql`when ${inventoryId}::uuid then ${quantity}::numeric`,
            ),
            sql` `,
          )} end)`

          // Held in the order of their IDs, as a stock count holds them; a
          // row is moved from the stock that the movements, changes and
          // counts it waited for left. A row deleted since the order was
          // read is one no item is for any more.
          const rows = await tx
            .select({
              id: inventory.id,
              overLimit: sql<boolean>`${inventory.currentStock} + ${arriving} > ${MAX_STOCK}`,
            })
            .from(inventory)
            .where(inArray(inventory.id, ids))
            .orderBy(asc(inventory.id))
            .for('update')
          const heldById = new Map(rows.map((row) => [row.id, row]))
          const gone = movements.flatMap(({ inventoryId }, index) =>
            heldById.has(inventoryId) ? [] : [index],
          )
          if (gone.length > 0) {
            return Result.success({
              type: 'itemsRefused',
              refusals: gone.map((index) => ({ type: 'notOrdered', index })),
            })
          }
          const over = movements.find(
            ({ inventoryId }) => heldById.get(inventoryId)?.overLimit === true,
          )
          if (over !== undefined) {
            return Result.success({
              type: 'overLimit',
              inventoryId: over.inventoryId,
            })
          }

          // The moment of the receipt: when its write begins, once the
          // order and every row of it are held. The delivery of the order,
          // the change of each row and each purchase are of it.
          const delivered = rowWritten('Update of delivered purchase order')(
            await tx
              .update(purchaseOrders)
              .set({
                status: 'delivered',
                actualDelivery: CHANGED_AT,
                updatedAt: CHANGED_AT,
                ...(deliveryNotes === null ? {} : { deliveryNotes }),
              })
              .where(eq(purchaseOrders.id, id))
              .returning(),
          )
          if (delivered.type === 'error') {
            return delivered
          }
          const at = delivered.data.updatedAt

          // The reserved stock stays, so what is available moves with what
          // there is. What a row held before is what it holds now less what
          // arrived.
          const moved = writtenFor('Update of received stock rows')(
            movements,
            ({ inventoryId }) => inventoryId,
            await tx
              .update(inventory)
              .set({
                currentStock: sql`${inventory.currentStock} + ${arriving}`,
                availableStock: sql`${inventory.availableStock} + ${arriving}`,
                updatedAt: at,
              })
              .where(inArray(inventory.id, ids))
              .returning({
                id: inventory.id,
                salonId: inventory.salonId,
                productId: inventory.productId,
                lotNumber: inventory.lotNumber,
                expiryDate: inventory.expiryDate,
                balanceBefore: sql<string>`(${inventory.currentStock} - ${arriving})::text`,
                balanceAfter: inventory.currentStock,
              }),
            ({ id: inventoryId }) => inventoryId,
          )
          if (moved.type === 'error') {
            return moved
          }

          const purchases = writtenFor('Insert of purchases')(
            movements,
            ({ inventoryId }) => inventoryId,
            await tx
              .insert(inventoryTransactions)
              .values(
                moved.data.map(({ item: movement, row }) => ({
                  ...movement,
                  transactionType: PURCHASE,
                  referenceType: PURCHASE_ORDER_REFERENCE,
                  referenceId: id,
                  reason: null,
                  performedBy,
                  salonId: row.salonId,
                  productId: row.productId,
                  lotNumber: row.lotNumber,
                  expiryDate: row.expiryDate,
                  balanceBefore: row.balanceBefore,
                  balanceAfter: row.balanceAfter,
                  createdAt: at,
                })),
              )
              .returning({ inventoryId: inventoryTransactions.inventoryId }),
            ({ inventoryId }) => inventoryId,
          )
          if (purchases.type === 'error') {
            return purchases
          }

          return Result.success({
            type: 'received',
            order: await withItems(tx, delivered.data),
          })
        },
        { isolationLevel: 'read committed' },
      ),
    )

    return Result.flatMap(received, (receipt) => receipt)
  }

  async listReorderSuggestions({
    salonId,
    limit,
    after,
  }: ReorderSuggestionCriteria): Promise<
    Result<ReorderSuggestionListing, DomainError>
  > {
    return attempt('Failed to list reorder suggestions', () =>
      this.db.transaction(async (tx): Promise<ReorderSuggestionListing> => {
        // The stock of each product at the salon, over all its rows.
        const stock = tx
          .select({
            productId: inventory.productId,
            currentStock: sql<string>`sum(${inventory.currentStock})`.as(
              'current_stock',
            ),
          })
          .from(inventory)
          .where(eq(inventory.salonId, salonId))
          .groupBy(inventory.productId)
          .as('stock')
        // What the open orders of the salon bring of each product, by the
        // stock rows of their items; an item whose row was deleted is of
        // no product any more.
        const onOrder = tx
          .select({
            productId: inventory.productId,
            quantity: sql<string>`sum(${purchaseOrderItems.quantity})`.as(
              'on_order_quantity',
            ),
          })
          .from(purchaseOrderItems)
          .innerJoin(
            purchaseOrders,
            eq(purchaseOrders.id, purchaseOrderItems.purchaseOrderId),
          )
          .innerJoin(
            inventory,
            eq(inventory.id, purchaseOrderItems.inventoryId),
          )
          .where(
            and(
              eq(purchaseOrders.salonId, salonId),
              notInArray(purchaseOrders.status, CLOSED),
            ),
          )
          .groupBy(inventory.productId)
          .as('on_order')
        // The latest order of each product that was not called off.
        const lastOrder = tx
          .select({
            productId: inventory.productId,
            orderDate: sql<string>`max(${purchaseOrders.orderDate})`.as(
              'last_order_date',
            ),
          })
          .from(purchaseOrderItems)
          .innerJoin(
            purchaseOrders,
            eq(purchaseOrders.id, purchaseOrderItems.purchaseOrderId),
          )
          .innerJoin(
            inventory,
            eq(inventory.id, purchaseOrderItems.inventoryId),
          )
          .where(
            and(
              eq(purchaseOrders.salonId, salonId),
              ne(purchaseOrders.status, 'cancelled'),
            ),
          )
          .groupBy(inventory.productId)
          .as('last_order')

        const onOrderQuantity = sql`coalesce(${onOrder.quantity}, 0)`
        const reorderPoint = sql`coalesce(${products.reorderPoint}, ${products.minimumStock})`
        const inHand = sql`(${stock.currentStock} + ${onOrderQuantity})`
        const suggested = sql`(coalesce(${products.maximumStock}, ${reorderPoint}) - ${inHand})`
        const filters = and(
          eq(products.salonId, salonId),
          eq(products.isActive, true),
          isNull(products.deletedAt),
          sql`${inHand} <= ${reorderPoint}`,
          sql`${suggested} > 0`,
        )

        // Keyset pagination on (productCode, id), from a product of the
        // salon to say where.
        const [cursor] =
          after === null
            ? []
            : await tx
                .select({ productCode: products.productCode, id: products.id })
                .from(products)
                .where(
                  and(eq(products.id, after), eq(products.salonId, salonId)),
                )
        if (after !== null && cursor === undefined) {
          return { type: 'cursorNotFound' }
        }
        const afterCursor =
          cursor === undefined
            ? undefined
            : sql`(${products.productCode}, ${products.id}) > (${cursor.productCode}, ${cursor.id}::uuid)`

        const found = await tx
          .select({
            productId: products.id,
            productCode: products.productCode,
            productName: products.name,
            unit: products.unit,
            supplier: products.supplier,
            currentStock: sql<string>`${stock.currentStock}::text`,
            onOrderQuantity: sql<string>`${onOrderQuantity}::text`,
            reorderPoint: sql<string>`${reorderPoint}::text`,
            maximumStock: products.maximumStock,
            suggestedQuantity: sql<string>`${suggested}::text`,
            lastOrderDate: sql<string | null>`${lastOrder.orderDate}`.mapWith(
              purchaseOrders.orderDate,
            ),
          })
          .from(products)
          .innerJoin(stock, eq(stock.productId, products.id))
          .leftJoin(onOrder, eq(onOrder.productId, products.id))
          .leftJoin(lastOrder, eq(lastOrder.productId, products.id))
          .where(and(filters, afterCursor))
          .orderBy(asc(products.productCode), asc(products.id))
          // One extra product tells whether another page follows.
          .limit(limit + 1)
        const counted = await tx
          .select({ total: count() })
          .from(products)
          .innerJoin(stock, eq(stock.productId, products.id))
          .leftJoin(onOrder, eq(onOrder.productId, products.id))
          .where(filters)

        return {
          type: 'listed',
          suggestions: found.slice(0, limit),
          total: totalOf(counted),
          hasMore: found.length > limit,
        }
      }, AT_ONE_MOMENT),
    )
  }

  /**
   * Holds the order and writes the values with the time of the change,
   * unless where the order stands refuses it. Two changes of one order take
   * turns, and the second is decided on what the first left.
   */
  private async change(
    message: string,
    write: string,
    reach: LedgerReach,
    id: PurchaseOrderId,
    refusalOf: (status: DbPurchaseOrder['status']) => OrderStatusRefusal | null,
    values: PgUpdateSetSource<typeof purchaseOrders>,
  ): Promise<Result<PurchaseOrderChange, DomainError>> {
    const changed = await attempt(message, () =>
      this.db.transaction(
        async (tx): Promise<Result<PurchaseOrderChange, DomainError>> => {
          const [held] = await tx
            .select({ status: purchaseOrders.status })
            .from(purchaseOrders)
            .where(and(eq(purchaseOrders.id, id), within(reach)))
            .for('update')
          if (held === undefined) {
            return Result.success({ type: 'notFound' })
          }
          const refusal = refusalOf(held.status)
          if (refusal !== null) {
            return Result.success(refusal)
          }

          const order = rowWritten(write)(
            await tx
              .update(purchaseOrders)
              .set({ ...values, updatedAt: CHANGED_AT })
              .where(eq(purchaseOrders.id, id))
              .returning(),
          )
          if (order.type === 'error') {
            return order
          }

          return Result.success({
            type: 'changed',
            order: await withItems(tx, order.data),
          })
        },
        { isolationLevel: 'read committed' },
      ),
    )

    return Result.flatMap(changed, (change) => change)
  }
}
