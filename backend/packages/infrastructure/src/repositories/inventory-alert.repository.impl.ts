import {
  inventory,
  inventoryAlertAcknowledgements,
  inventoryTransactions,
  products,
  salons,
} from '@beauty-salon-backend/database'
import {
  type AlertAcknowledgement,
  alertDaysOf,
  type DbAcknowledgementOfAlert,
  type DbInventoryAlertFacts,
  type DbProductStockOfAlert,
  type DbStockRowOfAlert,
  type DomainError,
  decideAcknowledgement,
  type IInventoryAlertRepository,
  type InventoryAlertAcknowledging,
  type InventoryAlertFactsAfter,
  type InventoryAlertFactsCriteria,
  type LedgerReach,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'
import { match } from 'ts-pattern'
import { attempt } from '../database/attempt'
import { CLOCK } from '../database/clock'
import type { Database, DatabaseExecutor } from '../database/index'
import { AT_ONE_MOMENT } from '../database/snapshot'
import { rowWritten } from '../database/written'

const acknowledgements = inventoryAlertAcknowledgements

type ProductAcknowledgement = Extract<
  DbAcknowledgementOfAlert,
  { type: 'product' }
>

type StockRowAcknowledgement = Extract<
  DbAcknowledgementOfAlert,
  { type: 'stockRow' }
>

/** The products an actor reaches. */
const productsWithin = (reach: LedgerReach): SQL | undefined =>
  match(reach)
    .with({ type: 'everySalon' }, () => undefined)
    .with({ type: 'salon' }, ({ salonId }) => eq(products.salonId, salonId))
    .exhaustive()

/** What the facts are read for: a whole salon, or one product or row. */
type Subject =
  | { type: 'salon' }
  | { type: 'product'; productId: string }
  | { type: 'stockRow'; inventoryId: string }

/**
 * The place of every product of the salon, deleted ones included, by
 * product code and then by ID, in the collation of the database. The IDs
 * make the order total, so a snapshot gives each product one place.
 */
const placesOf = (tx: DatabaseExecutor, salonId: string) =>
  tx
    .select({
      productId: products.id,
      place:
        sql<number>`(row_number() over (order by ${products.productCode}, ${products.id}))::int`
          .mapWith(Number)
          .as('place'),
    })
    .from(products)
    .where(eq(products.salonId, salonId))
    .as('places')

/**
 * The active products of the salon with stock rows there whose stock, the
 * sum over the rows, is at or below their minimum or above their maximum:
 * those that may have an alert, which `productAlertOf` decides on.
 */
const productsOf = async (
  tx: DatabaseExecutor,
  salonId: string,
  productId: string | null,
): Promise<DbProductStockOfAlert[]> => {
  const totals = tx
    .select({
      productId: inventory.productId,
      stock: sql<string>`sum(${inventory.currentStock})`.as('stock'),
    })
    .from(inventory)
    .where(
      and(
        eq(inventory.salonId, salonId),
        productId === null ? undefined : eq(inventory.productId, productId),
      ),
    )
    .groupBy(inventory.productId)
    .as('totals')
  const places = placesOf(tx, salonId)

  return tx
    .select({
      productId: products.id,
      salonId: products.salonId,
      productCode: products.productCode,
      productName: products.name,
      unit: products.unit,
      minimumStock: products.minimumStock,
      maximumStock: products.maximumStock,
      stock: sql<string>`${totals.stock}::text`,
      place: places.place,
    })
    .from(products)
    .innerJoin(totals, eq(totals.productId, products.id))
    .innerJoin(places, eq(places.productId, products.id))
    .where(
      and(
        eq(products.isActive, true),
        or(
          sql`${totals.stock} <= ${products.minimumStock}`,
          sql`${totals.stock} > ${products.maximumStock}`,
        ),
      ),
    )
}

/**
 * The stock rows of the salon with stock whose expiry date is at most the
 * last day that counts as expiring soon, those of inactive products
 * included: those that have an alert, which `stockRowAlertOf` decides on.
 */
const rowsOf = async (
  tx: DatabaseExecutor,
  salonId: string,
  lastExpiringDay: string,
  inventoryId: string | null,
): Promise<DbStockRowOfAlert[]> => {
  const places = placesOf(tx, salonId)

  return tx
    .select({
      inventoryId: inventory.id,
      salonId: inventory.salonId,
      productId: inventory.productId,
      productCode: products.productCode,
      productName: products.name,
      unit: products.unit,
      lotNumber: inventory.lotNumber,
      expiryDate: sql<string>`${inventory.expiryDate}::text`,
      currentStock: inventory.currentStock,
      place: places.place,
    })
    .from(inventory)
    .innerJoin(products, eq(products.id, inventory.productId))
    .innerJoin(places, eq(places.productId, inventory.productId))
    .where(
      and(
        eq(inventory.salonId, salonId),
        gt(inventory.currentStock, '0'),
        lte(inventory.expiryDate, lastExpiringDay),
        inventoryId === null ? undefined : eq(inventory.id, inventoryId),
      ),
    )
}

/**
 * The latest acknowledgement of each alert the products and rows may have,
 * with what their stock has been since.
 */
const acknowledgementsOf = async (
  tx: DatabaseExecutor,
  productIds: string[],
  inventoryIds: string[],
): Promise<DbAcknowledgementOfAlert[]> => {
  if (productIds.length === 0 && inventoryIds.length === 0) {
    return []
  }

  const latest = await tx
    .selectDistinctOn(
      [
        acknowledgements.productId,
        acknowledgements.inventoryId,
        acknowledgements.alert,
      ],
      { id: acknowledgements.id, inventoryId: acknowledgements.inventoryId },
    )
    .from(acknowledgements)
    .where(
      or(
        productIds.length === 0
          ? undefined
          : and(
              isNull(acknowledgements.inventoryId),
              inArray(acknowledgements.productId, productIds),
            ),
        inventoryIds.length === 0
          ? undefined
          : inArray(acknowledgements.inventoryId, inventoryIds),
      ),
    )
    .orderBy(
      acknowledgements.productId,
      acknowledgements.inventoryId,
      acknowledgements.alert,
      desc(acknowledgements.acknowledgedAt),
      desc(acknowledgements.id),
    )
  const ofProducts = latest.flatMap(({ id, inventoryId }) =>
    inventoryId === null ? [id] : [],
  )
  const ofRows = latest.flatMap(({ id, inventoryId }) =>
    inventoryId === null ? [] : [id],
  )

  return [
    ...(await productStockSince(tx, ofProducts)),
    ...(await rowStockSince(tx, ofRows)),
  ]
}

/**
 * Each acknowledgement, with the lowest and the highest stock of its
 * product at its salon from the time of the acknowledgement on: at that
 * time and after each moment at which movements of it were recorded
 * since. The stock after a moment is the stock now less what the movements
 * of the later moments brought, and the stock at the time of the
 * acknowledgement the stock now less what every movement since brought:
 * worked out of the movements, exactly, in `numeric`.
 */
const productStockSince = async (
  tx: DatabaseExecutor,
  ids: string[],
): Promise<ProductAcknowledgement[]> => {
  if (ids.length === 0) {
    return []
  }
  const moments = tx
    .select({
      acknowledgementId: acknowledgements.id,
      at: inventoryTransactions.createdAt,
      quantity: sql<string>`sum(${inventoryTransactions.quantity})`.as(
        'quantity',
      ),
    })
    .from(acknowledgements)
    .innerJoin(
      inventoryTransactions,
      and(
        eq(inventoryTransactions.salonId, acknowledgements.salonId),
        eq(inventoryTransactions.productId, acknowledgements.productId),
        gt(inventoryTransactions.createdAt, acknowledgements.acknowledgedAt),
      ),
    )
    .where(inArray(acknowledgements.id, ids))
    .groupBy(acknowledgements.id, inventoryTransactions.createdAt)
    .as('moments')
  // For each moment: what the later moments brought, and what all of them
  // since the acknowledgement brought.
  const later = tx
    .select({
      acknowledgementId: moments.acknowledgementId,
      later:
        sql<string>`coalesce(sum(${moments.quantity}) over (partition by ${moments.acknowledgementId} order by ${moments.at} desc rows between unbounded preceding and 1 preceding), 0)`.as(
          'later',
        ),
      since:
        sql<string>`sum(${moments.quantity}) over (partition by ${moments.acknowledgementId})`.as(
          'since',
        ),
    })
    .from(moments)
    .as('later')
  const spans = tx
    .select({
      acknowledgementId: later.acknowledgementId,
      most: sql<string>`greatest(max(${later.later}), max(${later.since}))`.as(
        'most',
      ),
      least: sql<string>`least(min(${later.later}), min(${later.since}))`.as(
        'least',
      ),
    })
    .from(later)
    .groupBy(later.acknowledgementId)
    .as('spans')
  const stockNow = sql`(select coalesce(sum(${inventory.currentStock}), 0) from ${inventory} where ${inventory.salonId} = ${acknowledgements.salonId} and ${inventory.productId} = ${acknowledgements.productId})`

  const found = await tx
    .select({
      acknowledgement: acknowledgements,
      lowestStock: sql<string>`(${stockNow} - coalesce(${spans.most}, 0))::text`,
      highestStock: sql<string>`(${stockNow} - coalesce(${spans.least}, 0))::text`,
    })
    .from(acknowledgements)
    .leftJoin(spans, eq(spans.acknowledgementId, acknowledgements.id))
    .where(inArray(acknowledgements.id, ids))

  return found.map(
    (fact): ProductAcknowledgement => ({ type: 'product', ...fact }),
  )
}

/**
 * Each acknowledgement, with the lowest stock its row was left with by a
 * movement since the acknowledgement; null when none was recorded. The
 * movements are joined: a select of one table writes the columns in the
 * SQL of its fields without their tables, and a subquery there would
 * compare the row of each movement with itself.
 */
const rowStockSince = async (
  tx: DatabaseExecutor,
  ids: string[],
): Promise<StockRowAcknowledgement[]> => {
  if (ids.length === 0) {
    return []
  }
  const lowest = tx
    .select({
      acknowledgementId: acknowledgements.id,
      stock: sql<string>`min(${inventoryTransactions.balanceAfter})::text`.as(
        'lowest_stock',
      ),
    })
    .from(acknowledgements)
    .innerJoin(
      inventoryTransactions,
      and(
        eq(inventoryTransactions.inventoryId, acknowledgements.inventoryId),
        gt(inventoryTransactions.createdAt, acknowledgements.acknowledgedAt),
      ),
    )
    .where(inArray(acknowledgements.id, ids))
    .groupBy(acknowledgements.id)
    .as('lowest')

  const found = await tx
    .select({ acknowledgement: acknowledgements, lowestStock: lowest.stock })
    .from(acknowledgements)
    .leftJoin(lowest, eq(lowest.acknowledgementId, acknowledgements.id))
    .where(inArray(acknowledgements.id, ids))

  return found.map(
    (fact): StockRowAcknowledgement => ({ type: 'stockRow', ...fact }),
  )
}

/** Everything the alerts of the salon, or of one product or row, come from. */
const factsOf = async (
  tx: DatabaseExecutor,
  { salonId, lastExpiringDay }: { salonId: string; lastExpiringDay: string },
  subject: Subject,
): Promise<DbInventoryAlertFacts> => {
  const productFacts = await match(subject)
    .returnType<Promise<DbProductStockOfAlert[]>>()
    .with({ type: 'salon' }, () => productsOf(tx, salonId, null))
    .with({ type: 'product' }, ({ productId }) =>
      productsOf(tx, salonId, productId),
    )
    .with({ type: 'stockRow' }, async () => [])
    .exhaustive()
  const rowFacts = await match(subject)
    .returnType<Promise<DbStockRowOfAlert[]>>()
    .with({ type: 'salon' }, () => rowsOf(tx, salonId, lastExpiringDay, null))
    .with({ type: 'stockRow' }, ({ inventoryId }) =>
      rowsOf(tx, salonId, lastExpiringDay, inventoryId),
    )
    .with({ type: 'product' }, async () => [])
    .exhaustive()
  const acknowledged = await acknowledgementsOf(
    tx,
    productFacts.map(({ productId }) => productId),
    rowFacts.map(({ inventoryId }) => inventoryId),
  )

  return {
    products: productFacts,
    rows: rowFacts,
    acknowledgements: acknowledged,
  }
}

export class InventoryAlertRepository implements IInventoryAlertRepository {
  constructor(private readonly db: Database) {}

  async listFacts(
    criteria: InventoryAlertFactsCriteria,
  ): Promise<Result<DbInventoryAlertFacts, DomainError>> {
    return attempt('Failed to list inventory alerts', () =>
      this.db.transaction(
        (tx) => factsOf(tx, criteria, { type: 'salon' }),
        AT_ONE_MOMENT,
      ),
    )
  }

  async listFactsAfter(
    criteria: InventoryAlertFactsCriteria,
    after: string,
  ): Promise<Result<InventoryAlertFactsAfter, DomainError>> {
    const { salonId } = criteria

    return attempt('Failed to list inventory alerts', () =>
      this.db.transaction(async (tx): Promise<InventoryAlertFactsAfter> => {
        // Where the alert about a product, or about a stock row, stands,
        // whether it is there now or not.
        const places = placesOf(tx, salonId)
        const [product] = await tx
          .select({ place: places.place })
          .from(places)
          .where(eq(places.productId, after))
        const [row] =
          product === undefined
            ? await tx
                .select({
                  id: inventory.id,
                  place: places.place,
                  expiryDate: sql<string | null>`${inventory.expiryDate}::text`,
                })
                .from(inventory)
                .innerJoin(places, eq(places.productId, inventory.productId))
                .where(
                  and(eq(inventory.id, after), eq(inventory.salonId, salonId)),
                )
            : []
        const position =
          product !== undefined
            ? { place: product.place, inventoryId: null, expiryDate: null }
            : row !== undefined
              ? {
                  place: row.place,
                  inventoryId: row.id,
                  expiryDate: row.expiryDate,
                }
              : null
        if (position === null) {
          return { type: 'cursorNotFound' }
        }

        const facts = await factsOf(tx, criteria, { type: 'salon' })
        return { type: 'listed', facts, after: position }
      }, AT_ONE_MOMENT),
    )
  }

  async acknowledge(
    reach: LedgerReach,
    request: AlertAcknowledgement,
    now: Date,
  ): Promise<Result<InventoryAlertAcknowledging, DomainError>> {
    const { productId, inventoryId } = request

    const acknowledged = await attempt(
      'Failed to acknowledge inventory alert',
      () =>
        this.db.transaction(
          async (
            tx,
          ): Promise<Result<InventoryAlertAcknowledging, DomainError>> => {
            // Held, the alerts of the product are acknowledged one at a
            // time, and its thresholds do not change until the
            // acknowledgement is written. A row of the product is still
            // written past it: an insert takes only a key share of it.
            const [product] = await tx
              .select({ salonId: products.salonId, timezone: salons.timezone })
              .from(products)
              .innerJoin(salons, eq(salons.id, products.salonId))
              .where(and(eq(products.id, productId), productsWithin(reach)))
              .for('no key update', { of: products })
            if (product === undefined) {
              return Result.success({ type: 'notFound' })
            }
            const days = alertDaysOf(now, product.timezone)
            if (days === null) {
              return Result.success({
                type: 'unknownTimeZone',
                salonId: product.salonId,
                timezone: product.timezone,
              })
            }

            // The rows the alert is decided on, held to share in the order
            // of their IDs: a movement, a count, a receipt or a change of
            // them in progress is waited for, and none begins until the
            // acknowledgement is written. So a movement recorded after the
            // acknowledgement is recorded at a later time.
            const held = await tx
              .select({ id: inventory.id })
              .from(inventory)
              .where(
                inventoryId === null
                  ? and(
                      eq(inventory.productId, productId),
                      eq(inventory.salonId, product.salonId),
                    )
                  : and(
                      eq(inventory.id, inventoryId),
                      eq(inventory.productId, productId),
                    ),
              )
              .orderBy(asc(inventory.id))
              .for('share')
            if (inventoryId !== null && held.length === 0) {
              return Result.success({ type: 'notFound' })
            }

            const facts = await factsOf(
              tx,
              {
                salonId: product.salonId,
                lastExpiringDay: days.lastExpiringDay,
              },
              inventoryId === null
                ? { type: 'product', productId }
                : { type: 'stockRow', inventoryId },
            )
            const decision = decideAcknowledgement(facts, days, request)
            if (decision.type !== 'acknowledge') {
              return Result.success(decision)
            }

            return Result.map(
              rowWritten('Insert of inventory alert acknowledgement')(
                await tx
                  .insert(acknowledgements)
                  .values({
                    ...decision.acknowledgement,
                    acknowledgedAt: CLOCK,
                  })
                  .returning(),
              ),
              (acknowledgement): InventoryAlertAcknowledging => ({
                type: 'acknowledged',
                alert: { ...decision.alert, acknowledgement },
              }),
            )
          },
          { isolationLevel: 'read committed' },
        ),
    )

    return Result.flatMap(acknowledged, (outcome) => outcome)
  }
}
