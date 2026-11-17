import { inventory, products } from '@beauty-salon-backend/database'
import {
  type DbInventory,
  type DbInventoryChanges,
  type DbNewInventory,
  type DomainError,
  DomainErrors,
  type IInventoryRepository,
  type InventoryCreation,
  type InventoryExpiringCriteria,
  type InventoryId,
  type InventoryList,
  type InventoryListCriteria,
  type InventoryLowStockCriteria,
  type InventoryRemoval,
  type InventoryUpdate,
  type LedgerReach,
  lotNumberRefusal,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import {
  and,
  asc,
  count,
  eq,
  getTableColumns,
  gt,
  isNotNull,
  isNull,
  lte,
  type SQL,
  sql,
} from 'drizzle-orm'
import { match, P } from 'ts-pattern'
import { CLOCK } from '../database/clock'
import { describeDatabaseError } from '../database/failure'
import type { Database, DatabaseExecutor } from '../database/index'

/**
 * The two ways the salon, the product and the lot number of a row repeat
 * another's: `inventory_unique` among the rows with a lot number, and
 * `inventory_unique_without_lot` among those without one.
 */
const lotUniqueViolation = {
  code: '23505',
  constraint_name: P.union('inventory_unique', 'inventory_unique_without_lot'),
}

/**
 * Turns a failed write into a domain error. A repeated lot is the only
 * expected failure, and only of a write that names a lot number (null is a
 * lot number a write names); drizzle wraps the driver error, so the
 * violation is looked for on the error and on its cause. Anything else is
 * unexpected and keeps a description that is safe to log.
 */
const toDomainError =
  (message: string, lotNumber: string | null | undefined) =>
  (cause: unknown): DomainError =>
    match({ cause, lotNumber })
      .with(
        {
          lotNumber: P.union(P.string, null),
          cause: P.union(lotUniqueViolation, { cause: lotUniqueViolation }),
        },
        (violation) =>
          DomainErrors.alreadyExists(
            'Inventory',
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

/** A write that found the database other than its constraints keep it. */
type Unwritten = { type: 'unwritten'; reason: string }

const creationOf = (
  outcome: InventoryCreation | Unwritten,
): Result<InventoryCreation, DomainError> =>
  outcome.type === 'unwritten'
    ? Result.error(DomainErrors.database(outcome.reason, null))
    : Result.success(outcome)

const updateOf = (
  outcome: InventoryUpdate | Unwritten,
): Result<InventoryUpdate, DomainError> =>
  outcome.type === 'unwritten'
    ? Result.error(DomainErrors.database(outcome.reason, null))
    : Result.success(outcome)

export class InventoryRepository implements IInventoryRepository {
  constructor(private readonly db: Database) {}

  async create(
    row: DbNewInventory,
  ): Promise<Result<InventoryCreation, DomainError>> {
    const written = await attempt(
      'Failed to create stock row',
      row.lotNumber,
      () =>
        this.db.transaction(
          async (tx): Promise<InventoryCreation | Unwritten> => {
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
              ? {
                  type: 'unwritten',
                  reason: 'Insert of stock row returned no row',
                }
              : { type: 'created', row: inserted }
          },
          { isolationLevel: 'read committed' },
        ),
    )

    return Result.flatMap(written, creationOf)
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

      const [page, [matching]] = await Promise.all([
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
        total: matching?.total ?? 0,
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

      const [page, [matching]] = await Promise.all([
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
        total: matching?.total ?? 0,
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

      const [page, [matching]] = await Promise.all([
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
        total: matching?.total ?? 0,
        hasMore: page.length > limit,
      }
    })
  }

  async update(
    reach: LedgerReach,
    id: InventoryId,
    changes: DbInventoryChanges,
  ): Promise<Result<InventoryUpdate, DomainError>> {
    const written = await attempt(
      'Failed to update stock row',
      changes.lotNumber,
      () =>
        this.db.transaction(
          async (tx): Promise<InventoryUpdate | Unwritten> => {
            const [held] = await tx
              .select({ productId: inventory.productId })
              .from(inventory)
              .where(and(eq(inventory.id, id), within(reach)))
              .for('update')
            if (held === undefined) {
              return { type: 'notFound' }
            }

            if (changes.lotNumber !== undefined) {
              // Held as a create holds it: the product says whether it is
              // kept by lots as it is once a change of it is written.
              const [product] = await tx
                .select({ requiresLotTracking: products.requiresLotTracking })
                .from(products)
                .where(eq(products.id, held.productId))
                .for('key share')
              if (product === undefined) {
                // The foreign key keeps the product of a row.
                return {
                  type: 'unwritten',
                  reason: `The product of stock row ${id} is not there`,
                }
              }
              const refusal = lotNumberRefusal(
                product.requiresLotTracking,
                changes.lotNumber,
              )
              if (refusal !== null) {
                return { type: 'lotNumberRefused', message: refusal }
              }
            }

            const [updated] = await tx
              .update(inventory)
              .set({ ...changes, updatedAt: CLOCK })
              .where(eq(inventory.id, id))
              .returning()

            return updated === undefined
              ? { type: 'notFound' }
              : { type: 'updated', row: updated }
          },
          { isolationLevel: 'read committed' },
        ),
    )

    return Result.flatMap(written, updateOf)
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
}
