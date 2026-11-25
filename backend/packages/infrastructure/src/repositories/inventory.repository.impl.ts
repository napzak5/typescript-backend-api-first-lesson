import {
  inventory,
  inventoryTransactions,
  products,
} from '@beauty-salon-backend/database'
import {
  type DbInventory,
  type DbInventoryChanges,
  type DbInventoryValueCategory,
  type DbNewInventory,
  type DbNewInventoryMovement,
  type DomainError,
  DomainErrors,
  type IInventoryRepository,
  type InventoryCreation,
  type InventoryExpiringCriteria,
  type InventoryId,
  type InventoryList,
  type InventoryListCriteria,
  type InventoryLowStockCriteria,
  type InventoryMovementListCriteria,
  type InventoryMovementListing,
  type InventoryMovementRecording,
  type InventoryRemoval,
  type InventoryStockCount,
  type InventoryStockCountCriteria,
  type InventoryUpdate,
  type LedgerReach,
  lotNumberRefusal,
  type SalonId,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import { entityMessages } from '@beauty-salon-shared/i18n/messages/api'
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  type SQL,
  sql,
} from 'drizzle-orm'
import { match, P } from 'ts-pattern'
import { CLOCK } from '../database/clock'
import { totalOf } from '../database/count'
import { describeDatabaseError } from '../database/failure'
import type { Database, DatabaseExecutor } from '../database/index'
import { AT_ONE_MOMENT } from '../database/snapshot'
import { rowWritten, written, writtenFor } from '../database/written'
import { uniqueViolation } from './_shared/unique-violation'

/**
 * The two ways the salon, the product and the lot number of a row repeat
 * another's: `inventory_unique` among the rows with a lot number, and
 * `inventory_unique_without_lot` among those without one.
 */
const lotUniqueViolation = uniqueViolation(
  P.union('inventory_unique', 'inventory_unique_without_lot'),
)

/**
 * Turns a failed write into a domain error. A repeated lot is the only
 * expected failure, and only of a write that names a lot number (null is a
 * lot number a write names). Anything else is unexpected and keeps a
 * description that is safe to log.
 */
const toDomainError =
  (message: string, lotNumber: string | null | undefined) =>
  (cause: unknown): DomainError =>
    match({ cause, lotNumber })
      .with(
        {
          lotNumber: P.union(P.string, null),
          cause: lotUniqueViolation,
        },
        (violation) =>
          DomainErrors.alreadyExists(
            entityMessages.inventory,
            'lotNumber',
            violation.lotNumber ?? 'null',
          ),
      )
      .otherwise(() =>
        DomainErrors.database(message, describeDatabaseError(cause)),
      )

const attempt = async <T>(
  message: string,
  lotNumber: string | null | undefined,
  run: () => Promise<T>,
): Promise<Result<T, DomainError>> =>
  Result.mapError(
    await Result.fromPromise(run()),
    toDomainError(message, lotNumber),
  )

/** The rows of the salons the reach covers. */
const within = (reach: LedgerReach): SQL | undefined =>
  match(reach)
    .with({ type: 'everySalon' }, () => undefined)
    .with({ type: 'salon' }, ({ salonId }) => eq(inventory.salonId, salonId))
    .exhaustive()

const inventoryColumns = getTableColumns(inventory)

/**
 * The lot number of a row in the order of the lists: a row without one
 * comes first. The API takes no lot number that is blank, so '' stands for
 * none; were there a row of '', it would tie with one without a lot number
 * and the ID would order them.
 */
const lotOrder = sql<string>`coalesce(${inventory.lotNumber}, '')`

/**
 * Keyset pagination on (product code, lot number, ID): the page starts
 * after the row the cursor names, which must be one the reach covers to
 * say where. Undefined for no cursor, null for a cursor that names no row.
 */
const afterRowOfStockList = async (
  executor: DatabaseExecutor,
  after: InventoryId | null,
  reach: SQL | undefined,
): Promise<SQL | undefined | null> => {
  if (after === null) {
    return undefined
  }
  const [cursor] = await executor
    .select({
      productCode: products.productCode,
      lot: lotOrder,
      id: inventory.id,
    })
    .from(inventory)
    .innerJoin(products, eq(products.id, inventory.productId))
    .where(and(eq(inventory.id, after), reach))
  if (cursor === undefined) {
    return null
  }

  return sql`(${products.productCode}, ${lotOrder}, ${inventory.id}) > (${cursor.productCode}::varchar, ${cursor.lot}::varchar, ${cursor.id}::uuid)`
}

const STOCK_LIST_ORDER = [
  asc(products.productCode),
  asc(lotOrder),
  asc(inventory.id),
]

/** The kind of the movements a stock count records. */
const ADJUSTMENT: (typeof inventoryTransactions.$inferInsert)['transactionType'] =
  'adjustment'

/** The most stock a row holds: its columns are `numeric(10, 2)`. */
const MAX_STOCK = sql`99999999.99`

/**
 * The time of a movement as a response shows it, to the millisecond: a
 * filter by the time a client was shown matches the movement it was shown.
 */
const movedAt = sql`date_trunc('milliseconds', ${inventoryTransactions.createdAt})`

export class InventoryRepository implements IInventoryRepository {
  constructor(private readonly db: Database) {}

  async create(
    row: DbNewInventory,
  ): Promise<Result<InventoryCreation, DomainError>> {
    const created = await attempt(
      'Failed to create stock row',
      row.lotNumber,
      () =>
        this.db.transaction(
          async (tx): Promise<InventoryCreation | null> => {
            // The lock is the one a delete or a change of the product waits
            // for and is waited for by: a product that is being deleted is
            // gone by the time this statement returns, and one that is being
            // changed says whether it is kept by lots as it is once changed.
            const [product] = await tx
              .select({ requiresLotTracking: products.requiresLotTracking })
              .from(products)
              .where(
                and(
                  eq(products.id, row.productId),
                  eq(products.salonId, row.salonId),
                  isNull(products.deletedAt),
                ),
              )
              .for('key share')
            if (product === undefined) {
              return { type: 'productNotFound' }
            }
            const refusal = lotNumberRefusal(
              product.requiresLotTracking,
              row.lotNumber,
            )
            if (refusal !== null) {
              return { type: 'lotNumberRefused', message: refusal }
            }

            const [inserted] = await tx
              .insert(inventory)
              .values({
                ...row,
                currentStock: '0',
                availableStock: '0',
                reservedStock: '0',
              })
              .returning()

            return inserted === undefined
              ? null
              : { type: 'created', row: inserted }
          },
          { isolationLevel: 'read committed' },
        ),
    )

    return Result.flatMap(created, written('Insert of stock row'))
  }

  async findById(
    reach: LedgerReach,
    id: InventoryId,
  ): Promise<Result<DbInventory | null, DomainError>> {
    return attempt('Failed to find stock row', undefined, async () => {
      const [row] = await this.db
        .select()
        .from(inventory)
        .where(and(eq(inventory.id, id), within(reach)))
        .limit(1)

      return row ?? null
    })
  }

  async list({
    reach,
    limit,
    after,
    salonId,
    productId,
    lotNumber,
  }: InventoryListCriteria): Promise<
    Result<InventoryList | null, DomainError>
  > {
    const filters = and(
      within(reach),
      salonId === null ? undefined : eq(inventory.salonId, salonId),
      productId === null ? undefined : eq(inventory.productId, productId),
      lotNumber === null ? undefined : eq(inventory.lotNumber, lotNumber),
    )

    return attempt('Failed to list stock rows', undefined, async () => {
      const afterCursor = await afterRowOfStockList(
        this.db,
        after,
        within(reach),
      )
      if (afterCursor === null) {
        return null
      }

      const [page, counted] = await Promise.all([
        this.db
          .select(inventoryColumns)
          .from(inventory)
          .innerJoin(products, eq(products.id, inventory.productId))
          .where(and(filters, afterCursor))
          .orderBy(...STOCK_LIST_ORDER)
          // One extra row tells whether another page follows.
          .limit(limit + 1),
        this.db.select({ total: count() }).from(inventory).where(filters),
      ])

      return {
        rows: page.slice(0, limit),
        total: totalOf(counted),
        hasMore: page.length > limit,
      }
    })
  }

  async listLowStock({
    salonId,
    limit,
    after,
    threshold,
  }: InventoryLowStockCriteria): Promise<
    Result<InventoryList | null, DomainError>
  > {
    // The stock of each product at the salon, over all its rows.
    const totals = this.db
      .select({
        productId: inventory.productId,
        stock: sql<string>`sum(${inventory.currentStock})`.as('stock'),
      })
      .from(inventory)
      .where(eq(inventory.salonId, salonId))
      .groupBy(inventory.productId)
      .as('totals')
    const filters = and(
      eq(inventory.salonId, salonId),
      eq(products.isActive, true),
      threshold === null
        ? sql`${totals.stock} <= ${products.minimumStock}`
        : sql`${totals.stock} <= ${threshold}::numeric`,
    )

    return attempt('Failed to list low stock', undefined, async () => {
      const afterCursor = await afterRowOfStockList(
        this.db,
        after,
        eq(inventory.salonId, salonId),
      )
      if (afterCursor === null) {
        return null
      }

      const [page, counted] = await Promise.all([
        this.db
          .select(inventoryColumns)
          .from(inventory)
          .innerJoin(products, eq(products.id, inventory.productId))
          .innerJoin(totals, eq(totals.productId, inventory.productId))
          .where(and(filters, afterCursor))
          .orderBy(...STOCK_LIST_ORDER)
          .limit(limit + 1),
        this.db
          .select({ total: count() })
          .from(inventory)
          .innerJoin(products, eq(products.id, inventory.productId))
          .innerJoin(totals, eq(totals.productId, inventory.productId))
          .where(filters),
      ])

      return {
        rows: page.slice(0, limit),
        total: totalOf(counted),
        hasMore: page.length > limit,
      }
    })
  }

  async listExpiring({
    salonId,
    limit,
    after,
    until,
  }: InventoryExpiringCriteria): Promise<
    Result<InventoryList | null, DomainError>
  > {
    const filters = and(
      eq(inventory.salonId, salonId),
      lte(inventory.expiryDate, until),
      gt(inventory.currentStock, '0'),
    )

    return attempt('Failed to list expiring stock', undefined, async () => {
      // Keyset pagination on (expiry date, ID), from a row of the salon
      // that has an expiry date to say where.
      const [cursor] =
        after === null
          ? []
          : await this.db
              .select({ expiryDate: inventory.expiryDate, id: inventory.id })
              .from(inventory)
              .where(
                and(
                  eq(inventory.id, after),
                  eq(inventory.salonId, salonId),
                  isNotNull(inventory.expiryDate),
                ),
              )
      if (after !== null && cursor === undefined) {
        return null
      }
      const afterCursor =
        cursor === undefined
          ? undefined
          : sql`(${inventory.expiryDate}, ${inventory.id}) > (${cursor.expiryDate}::date, ${cursor.id}::uuid)`

      const [page, counted] = await Promise.all([
        this.db
          .select()
          .from(inventory)
          .where(and(filters, afterCursor))
          .orderBy(asc(inventory.expiryDate), asc(inventory.id))
          .limit(limit + 1),
        this.db.select({ total: count() }).from(inventory).where(filters),
      ])

      return {
        rows: page.slice(0, limit),
        total: totalOf(counted),
        hasMore: page.length > limit,
      }
    })
  }

  async update(
    reach: LedgerReach,
    id: InventoryId,
    changes: DbInventoryChanges,
  ): Promise<Result<InventoryUpdate, DomainError>> {
    return attempt('Failed to update stock row', changes.lotNumber, () =>
      this.db.transaction(
        async (tx): Promise<InventoryUpdate> => {
          if (changes.lotNumber !== undefined) {
            // The row with its product, held as a create holds it: the
            // product says whether it is kept by lots as it is once a
            // change of it is written.
            const [held] = await tx
              .select({ requiresLotTracking: products.requiresLotTracking })
              .from(inventory)
              .innerJoin(products, eq(products.id, inventory.productId))
              .where(and(eq(inventory.id, id), within(reach)))
              .for('key share', { of: products })
            if (held === undefined) {
              return { type: 'notFound' }
            }
            const refusal = lotNumberRefusal(
              held.requiresLotTracking,
              changes.lotNumber,
            )
            if (refusal !== null) {
              return { type: 'lotNumberRefused', message: refusal }
            }
          }

          // The update waits for a delete or a stock movement of the row
          // that is under way, and finds what it left: a row deleted
          // meanwhile is not there.
          const [updated] = await tx
            .update(inventory)
            .set({ ...changes, updatedAt: CLOCK })
            .where(and(eq(inventory.id, id), within(reach)))
            .returning()

          return updated === undefined
            ? { type: 'notFound' }
            : { type: 'updated', row: updated }
        },
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async delete(
    reach: LedgerReach,
    id: InventoryId,
  ): Promise<Result<InventoryRemoval, DomainError>> {
    return attempt('Failed to delete stock row', undefined, () =>
      this.db.transaction(
        async (tx): Promise<InventoryRemoval> => {
          // Held, the row counts what it counts until it is deleted: a
          // stock movement of it waits for the delete, and finds no row.
          const [held] = await tx
            .select({ currentStock: inventory.currentStock })
            .from(inventory)
            .where(and(eq(inventory.id, id), within(reach)))
            .for('update')
          if (held === undefined) {
            return { type: 'notFound' }
          }
          if (Number(held.currentStock) !== 0) {
            return { type: 'inStock' }
          }

          await tx.delete(inventory).where(eq(inventory.id, id))

          return { type: 'deleted' }
        },
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async recordMovement(
    reach: LedgerReach,
    id: InventoryId,
    movement: DbNewInventoryMovement,
  ): Promise<Result<InventoryMovementRecording, DomainError>> {
    const quantity = sql`${movement.quantity}::numeric`

    const recorded = await attempt(
      'Failed to record stock movement',
      undefined,
      () =>
        this.db.transaction(
          async (
            tx,
          ): Promise<Result<InventoryMovementRecording, DomainError>> => {
            // Held, the row is moved by one movement at a time, each from
            // the stock the one before it left; its removal and its changes
            // wait as well, and it is decided on the stock as it is then.
            const [held] = await tx
              .select({
                currentStock: inventory.currentStock,
                belowReserved: sql<boolean>`${inventory.currentStock} + ${quantity} < ${inventory.reservedStock}`,
                overLimit: sql<boolean>`${inventory.currentStock} + ${quantity} > ${MAX_STOCK}`,
              })
              .from(inventory)
              .where(and(eq(inventory.id, id), within(reach)))
              .for('update')
            if (held === undefined) {
              return Result.success({ type: 'notFound' })
            }
            if (held.belowReserved) {
              return Result.success({ type: 'belowReserved' })
            }
            if (held.overLimit) {
              return Result.success({ type: 'overLimit' })
            }

            // The reserved stock stays, so what is available moves with
            // what there is.
            const moved = rowWritten('Update of moved stock row')(
              await tx
                .update(inventory)
                .set({
                  currentStock: sql`${inventory.currentStock} + ${quantity}`,
                  availableStock: sql`${inventory.availableStock} + ${quantity}`,
                  updatedAt: CLOCK,
                })
                .where(eq(inventory.id, id))
                .returning({
                  salonId: inventory.salonId,
                  productId: inventory.productId,
                  lotNumber: inventory.lotNumber,
                  expiryDate: inventory.expiryDate,
                  currentStock: inventory.currentStock,
                }),
            )
            if (moved.type === 'error') {
              return moved
            }

            return Result.map(
              rowWritten('Insert of stock movement')(
                await tx
                  .insert(inventoryTransactions)
                  .values({
                    ...movement,
                    salonId: moved.data.salonId,
                    productId: moved.data.productId,
                    inventoryId: id,
                    lotNumber: moved.data.lotNumber,
                    expiryDate: moved.data.expiryDate,
                    balanceBefore: held.currentStock,
                    balanceAfter: moved.data.currentStock,
                    createdAt: CLOCK,
                  })
                  .returning(),
              ),
              (transaction): InventoryMovementRecording => ({
                type: 'recorded',
                transaction,
              }),
            )
          },
          { isolationLevel: 'read committed' },
        ),
    )

    return Result.flatMap(recorded, (recording) => recording)
  }

  async listMovements(
    reach: LedgerReach,
    {
      inventoryId,
      limit,
      after,
      transactionType,
      startDate,
      endDate,
    }: InventoryMovementListCriteria,
  ): Promise<Result<InventoryMovementListing, DomainError>> {
    const filters = and(
      eq(inventoryTransactions.inventoryId, inventoryId),
      transactionType === null
        ? undefined
        : eq(inventoryTransactions.transactionType, transactionType),
      startDate === null
        ? undefined
        : sql`${movedAt} >= ${startDate}::timestamptz`,
      endDate === null ? undefined : sql`${movedAt} <= ${endDate}::timestamptz`,
    )

    return attempt('Failed to list stock movements', undefined, () =>
      this.db.transaction(async (tx): Promise<InventoryMovementListing> => {
        const [row] = await tx
          .select({ id: inventory.id })
          .from(inventory)
          .where(and(eq(inventory.id, inventoryId), within(reach)))
        if (row === undefined) {
          return { type: 'inventoryNotFound' }
        }

        // Keyset pagination on (createdAt, id), downwards: the page starts
        // after the movement the cursor names, which has to be one of the
        // row.
        const [cursor] =
          after === null
            ? []
            : await tx
                .select({
                  createdAt: inventoryTransactions.createdAt,
                  id: inventoryTransactions.id,
                })
                .from(inventoryTransactions)
                .where(
                  and(
                    eq(inventoryTransactions.id, after),
                    eq(inventoryTransactions.inventoryId, inventoryId),
                  ),
                )
        if (after !== null && cursor === undefined) {
          return { type: 'cursorNotFound' }
        }
        const afterCursor =
          cursor === undefined
            ? undefined
            : sql`(${inventoryTransactions.createdAt}, ${inventoryTransactions.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`

        const found = await tx
          .select()
          .from(inventoryTransactions)
          .where(and(filters, afterCursor))
          .orderBy(
            desc(inventoryTransactions.createdAt),
            desc(inventoryTransactions.id),
          )
          // One extra row tells whether another page follows.
          .limit(limit + 1)
        const counted = await tx
          .select({ total: count() })
          .from(inventoryTransactions)
          .where(filters)

        return {
          type: 'listed',
          transactions: found.slice(0, limit),
          total: totalOf(counted),
          hasMore: found.length > limit,
        }
      }, AT_ONE_MOMENT),
    )
  }

  async performStockCount({
    salonId,
    items,
    reason,
    performedBy,
  }: InventoryStockCountCriteria): Promise<
    Result<InventoryStockCount, DomainError>
  > {
    const ids = items.map(({ inventoryId }) => inventoryId)
    // What was counted of a row of the count, as a value of the row.
    const counted = sql`(case ${inventory.id} ${sql.join(
      items.map(
        ({ inventoryId, countedQuantity }) =>
          sql`when ${inventoryId}::uuid then ${countedQuantity}::numeric`,
      ),
      sql` `,
    )} end)`
    // The moment of the count: when its write begins, once every row of it
    // is held. Every row and every adjustment of the count are of it.
    const countedAt = sql`statement_timestamp()`

    const performed = await attempt(
      'Failed to perform stock count',
      undefined,
      () =>
        this.db.transaction(
          async (tx): Promise<Result<InventoryStockCount, DomainError>> => {
            // Held in the order of their IDs: two counts that share rows
            // take them in one order, so neither waits for a row while it
            // holds one the other waits for. A row is compared with what
            // was counted as it is once held, after the movements, changes
            // and counts it waited for; held, it keeps its product, lot
            // and expiry date until the count is written.
            const held = await tx
              .select({
                id: inventory.id,
                productId: inventory.productId,
                lotNumber: inventory.lotNumber,
                expiryDate: inventory.expiryDate,
                expected: inventory.currentStock,
                counted: sql<string>`${counted}::text`,
                difference: sql<string>`(${counted} - ${inventory.currentStock})::text`,
                differs: sql<boolean>`${counted} <> ${inventory.currentStock}`,
                belowReserved: sql<boolean>`${counted} < ${inventory.reservedStock}`,
              })
              .from(inventory)
              .where(
                and(inArray(inventory.id, ids), eq(inventory.salonId, salonId)),
              )
              .orderBy(asc(inventory.id))
              .for('update')
            const heldById = new Map(held.map((row) => [row.id, row]))
            // The rows in the order of the count.
            const found = items.flatMap(
              ({ inventoryId }) => heldById.get(inventoryId) ?? [],
            )
            if (found.length < items.length) {
              return Result.success({
                type: 'rowsNotFound',
                indexes: items.flatMap(({ inventoryId }, index) =>
                  heldById.has(inventoryId) ? [] : [index],
                ),
              })
            }
            const below = found.find(({ belowReserved }) => belowReserved)
            if (below !== undefined) {
              return Result.success({
                type: 'belowReserved',
                inventoryId: below.id,
              })
            }

            // The reserved stock stays, so what is available is what was
            // counted less it. A row that does not differ is written too:
            // it was counted.
            const countedRows = writtenFor('Update of counted stock rows')(
              found,
              ({ id }) => id,
              await tx
                .update(inventory)
                .set({
                  currentStock: counted,
                  availableStock: sql`${counted} - ${inventory.reservedStock}`,
                  lastCountedAt: countedAt,
                  lastCountedBy: performedBy,
                  updatedAt: countedAt,
                })
                .where(inArray(inventory.id, ids))
                .returning({
                  id: inventory.id,
                  countedAt: sql`${inventory.lastCountedAt}`.mapWith(
                    inventory.lastCountedAt,
                  ),
                }),
              ({ id }) => id,
            )
            if (countedRows.type === 'error') {
              return countedRows
            }

            const differing = countedRows.data.filter(
              ({ item }) => item.differs,
            )
            const adjustments: (typeof inventoryTransactions.$inferInsert)[] =
              differing.map(({ item, row }) => ({
                transactionType: ADJUSTMENT,
                quantity: item.difference,
                unitCost: null,
                totalCost: null,
                referenceType: null,
                referenceId: null,
                reason,
                performedBy,
                salonId,
                productId: item.productId,
                inventoryId: item.id,
                lotNumber: item.lotNumber,
                expiryDate: item.expiryDate,
                balanceBefore: item.expected,
                balanceAfter: item.counted,
                createdAt: row.countedAt,
              }))
            const recorded = writtenFor('Insert of stock count adjustments')(
              differing,
              ({ item }) => item.id,
              adjustments.length === 0
                ? []
                : await tx
                    .insert(inventoryTransactions)
                    .values(adjustments)
                    .returning(),
              ({ inventoryId }) => inventoryId,
            )

            return Result.map(
              recorded,
              (paired): InventoryStockCount => ({
                type: 'counted',
                adjustments: paired.map(({ row }) => row),
                discrepancies: paired.map(({ item: { item } }) => ({
                  inventoryId: item.id,
                  expected: item.expected,
                  counted: item.counted,
                  difference: item.difference,
                })),
              }),
            )
          },
          { isolationLevel: 'read committed' },
        ),
    )

    return Result.flatMap(performed, (count) => count)
  }

  async valueReport(
    salonId: SalonId,
    category: string | null,
  ): Promise<Result<DbInventoryValueCategory[], DomainError>> {
    // Stock times purchase price, without one at 0, rounded half up to the
    // yen once a category is summed.
    const value = sql`round(sum(${inventory.currentStock} * coalesce(${products.purchasePrice}, 0)))`

    // One statement reads one snapshot and waits for no lock.
    return attempt('Failed to read the value of the stock', undefined, () =>
      this.db
        .select({
          category: products.category,
          value: sql<string>`${value}::text`,
          itemCount: sql<number>`count(distinct ${products.id})::int`,
        })
        .from(inventory)
        .innerJoin(products, eq(products.id, inventory.productId))
        .where(
          and(
            eq(inventory.salonId, salonId),
            gt(inventory.currentStock, '0'),
            category === null ? undefined : eq(products.category, category),
          ),
        )
        .groupBy(products.category)
        .orderBy(desc(value), sql`${products.category} asc nulls last`)
        .execute(),
    )
  }
}
