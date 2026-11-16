import {
  bookings,
  customers,
  paymentTransactions,
  products,
  sales,
  salesDetails,
  salons,
  services,
  staff,
} from '@beauty-salon-backend/database'
import {
  type BookingOfSale,
  bookingToHold,
  type DbPaymentTransaction,
  type DbSale,
  type DbSalesDetail,
  type DomainError,
  type ISaleRepository,
  type LedgerReach,
  PRODUCT_ITEM,
  planSale,
  planSaleChange,
  refusalOfChange,
  refusalOfVoid,
  type SaleChangeReferences,
  type SaleCreateRequest,
  type SaleCreation,
  type SaleId,
  type SaleList,
  type SaleListCriteria,
  type SaleOrigin,
  type SaleReferences,
  type SalesDetailRequest,
  type SaleUpdate,
  type SaleUpdateRequest,
  type SaleVoiding,
  type SaleVoidRequest,
  type SaleWithDetails,
  type SaleWrite,
  type SalonOfSale,
  SERVICE_ITEM,
} from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  not,
  type SQL,
  sql,
} from 'drizzle-orm'
import type { PgTransactionConfig } from 'drizzle-orm/pg-core'
import { match } from 'ts-pattern'
import { attempt } from '../database/attempt'
import { CLOCK } from '../database/clock'
import type { Database, DatabaseExecutor } from '../database/index'

/**
 * The statements of a read see the database as it was at one moment: a
 * sale is read with the payments it had when it said what its payment
 * status is, never with one that came in between two statements.
 */
const AT_ONE_MOMENT: PgTransactionConfig = {
  isolationLevel: 'repeatable read',
  accessMode: 'read only',
}

/** The condition that keeps a query to the sales a reader reaches. */
const within = (reach: LedgerReach): SQL | undefined =>
  match(reach)
    .with({ type: 'everySalon' }, () => undefined)
    .with({ type: 'salon' }, ({ salonId }) => eq(sales.salonId, salonId))
    .exhaustive()

/** The IDs among these that are there, without the ones that are null. */
const named = (ids: readonly (string | null)[]): string[] => [
  ...new Set(ids.flatMap((id) => (id === null ? [] : [id]))),
]

/** The `itemId`s of the lines that are of that type. */
const itemIdsOf = (
  details: readonly SalesDetailRequest[],
  itemType: string,
): string[] =>
  named(
    details
      .filter((line) => line.itemType === itemType)
      .map(({ itemId }) => itemId),
  )

/**
 * The booking a sale is the bill of, held `FOR UPDATE` until the sale is
 * written: of the requests that bill one booking at the same moment the
 * second waits here, and the look for a sale of the booking, which is a
 * statement of its own after the wait, meets the sale of the first. A
 * delete of the booking waits for the sale and finds it; one that came
 * first leaves no booking to be found here.
 *
 * `billing` is the sale that is being corrected, which does not stand in
 * its own way; null for a sale that is being entered.
 */
const heldBookingOf = async (
  tx: DatabaseExecutor,
  bookingId: string | null,
  salonId: string,
  billing: string | null,
): Promise<BookingOfSale | null> => {
  if (bookingId === null) {
    return null
  }

  const [booking] = await tx
    .select({ customerId: bookings.customerId })
    .from(bookings)
    .where(and(eq(bookings.id, bookingId), eq(bookings.salonId, salonId)))
    .for('update')
  if (booking === undefined) {
    return null
  }
  const [billed] = await tx
    .select({ id: sales.id })
    .from(sales)
    .where(
      and(
        eq(sales.bookingId, bookingId),
        not(sales.isVoid),
        billing === null ? undefined : ne(sales.id, billing),
      ),
    )
    .limit(1)

  return { customerId: booking.customerId, isBilled: billed !== undefined }
}

/** Whether the customer is there, held `FOR KEY SHARE`; of no customer, false. */
const heldCustomerIsThere = async (
  tx: DatabaseExecutor,
  customerId: string | null,
): Promise<boolean> => {
  if (customerId === null) {
    return false
  }
  const [customer] = await tx
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, customerId), isNull(customers.deletedAt)))
    .for('key share')

  return customer !== undefined
}

/**
 * Of the staff members, the services and the products a request names,
 * those of the salon that are there. The staff members are held `FOR KEY
 * SHARE`, by their IDs.
 */
const soldOf = async (
  tx: DatabaseExecutor,
  salonId: string,
  staffId: string | null,
  details: readonly SalesDetailRequest[],
): Promise<Pick<SaleReferences, 'staffIds' | 'serviceIds' | 'productIds'>> => {
  const staffIds = named([staffId, ...details.map((line) => line.staffId)])
  const serviceIds = itemIdsOf(details, SERVICE_ITEM)
  const productIds = itemIdsOf(details, PRODUCT_ITEM)

  const staffMembers =
    staffIds.length === 0
      ? []
      : await tx
          .select({ id: staff.id })
          .from(staff)
          .where(
            and(
              inArray(staff.id, staffIds),
              eq(staff.salonId, salonId),
              isNull(staff.deletedAt),
            ),
          )
          .orderBy(asc(staff.id))
          .for('key share')
  const soldServices =
    serviceIds.length === 0
      ? []
      : await tx
          .select({ id: services.id })
          .from(services)
          .where(
            and(
              inArray(services.id, serviceIds),
              eq(services.salonId, salonId),
              isNull(services.deletedAt),
            ),
          )
  const soldProducts =
    productIds.length === 0
      ? []
      : await tx
          .select({ id: products.id })
          .from(products)
          .where(
            and(
              inArray(products.id, productIds),
              eq(products.salonId, salonId),
              isNull(products.deletedAt),
            ),
          )

  return {
    staffIds: staffMembers.map(({ id }) => id),
    serviceIds: soldServices.map(({ id }) => id),
    productIds: soldProducts.map(({ id }) => id),
  }
}

/**
 * What a create request refers to, as far as it is there.
 *
 * The rows a sale points at with a foreign key (its booking, its salon,
 * its customer, its staff members) are locked here, before the sale is
 * written: the booking as `heldBookingOf` says, the others `FOR KEY SHARE`,
 * which is the lock the insert takes on them anyway. Taken here, the locks
 * are taken in the order every transaction takes its locks in (the
 * booking, the salon, the customer, the staff members by their IDs), so a
 * sale and a booking that name the same staff members never wait for each
 * other. A delete of one of the rows holds it `FOR UPDATE`: it waits for
 * the sale, or the sale waits for it and does not find the row.
 *
 * A line names a service or a product without a foreign key, and takes
 * its name and its amounts from the request: those rows are only looked
 * for.
 */
const referencesOf = async (
  tx: DatabaseExecutor,
  request: SaleCreateRequest,
): Promise<SaleReferences> => {
  const booking = await heldBookingOf(
    tx,
    request.bookingId,
    request.salonId,
    null,
  )
  const [salon] = await tx
    .select({ timezone: salons.timezone })
    .from(salons)
    .where(and(eq(salons.id, request.salonId), isNull(salons.deletedAt)))
    .for('key share')
  const customerExists = await heldCustomerIsThere(tx, request.customerId)
  if (salon === undefined) {
    return {
      salon: null,
      customerExists,
      staffIds: [],
      serviceIds: [],
      productIds: [],
      booking,
    }
  }

  return {
    salon,
    customerExists,
    ...(await soldOf(tx, request.salonId, request.staffId, request.details)),
    booking,
  }
}

/** A sale that is held, with what it takes from its salon. */
type HeldSale = { sale: DbSale; salon: SalonOfSale }

/**
 * The sale a change is of, held `FOR UPDATE` until the change is written.
 * Of the changes of one sale each waits here for the one before it, and
 * what it reads afterwards is what that one left. The lock is the one that
 * the foreign key of a payment does not get past: no payment of the sale
 * is written while it is held, and one that is being written is waited
 * for.
 *
 * The sale is the first row a change holds; nothing that holds a booking,
 * a customer or a staff member goes on to hold a sale, so the changes of
 * sales wait for nothing that waits for them.
 */
const heldSaleOf = async (
  tx: DatabaseExecutor,
  id: SaleId,
  reach: LedgerReach,
): Promise<HeldSale | null> => {
  const [held] = await tx
    .select({ sale: sales, salon: { timezone: salons.timezone } })
    .from(sales)
    .innerJoin(salons, eq(salons.id, sales.salonId))
    .where(and(eq(sales.id, id), within(reach)))
    .for('update', { of: sales })

  return held ?? null
}

/**
 * What a correction refers to, as far as it is there: only what the
 * request names is looked for, and locked as for a sale that is entered,
 * in the same order (the booking, the customer, the staff members by
 * their IDs). The salon is that of the sale, and the day of a sale of a
 * deleted salon is still a day of its time zone.
 */
const changeReferencesOf = async (
  tx: DatabaseExecutor,
  { sale, salon }: HeldSale,
  request: SaleUpdateRequest,
): Promise<SaleChangeReferences> => {
  const booking = await heldBookingOf(
    tx,
    bookingToHold(sale, request),
    sale.salonId,
    sale.id,
  )
  const customerExists = await heldCustomerIsThere(
    tx,
    request.customerId ?? null,
  )

  return {
    salon,
    customerExists,
    ...(await soldOf(
      tx,
      sale.salonId,
      request.staffId ?? null,
      request.details ?? [],
    )),
    booking,
  }
}

/**
 * Writes a sale that was planned, with its lines. Nothing is written when
 * another sale has the number.
 */
const written = async (
  tx: DatabaseExecutor,
  write: SaleWrite,
): Promise<
  { type: 'created'; sale: SaleWithDetails } | { type: 'saleNumberTaken' }
> => {
  const [sale] = await tx
    .insert(sales)
    .values(write.sale)
    .onConflictDoNothing({ target: sales.saleNumber })
    .returning()
  if (sale === undefined) {
    return { type: 'saleNumberTaken' }
  }
  const details = await tx
    .insert(salesDetails)
    .values(write.details.map((detail) => ({ ...detail, saleId: sale.id })))
    .returning()

  return {
    type: 'created',
    sale: {
      sale,
      details: details.toSorted((a, b) => a.sortOrder - b.sortOrder),
      // A sale is paid after it is entered.
      payments: [],
    },
  }
}

/**
 * The sales of the rows of a join of sales and their lines, in the order
 * the rows have, each with the payments made for it, in the order they
 * were made.
 */
const gathered = async (
  tx: DatabaseExecutor,
  rows: readonly { sale: DbSale; detail: DbSalesDetail | null }[],
): Promise<SaleWithDetails[]> => {
  const bySale = Map.groupBy(rows, ({ sale }) => sale.id)
  const payments: DbPaymentTransaction[] =
    bySale.size === 0
      ? []
      : await tx
          .select()
          .from(paymentTransactions)
          .where(inArray(paymentTransactions.saleId, [...bySale.keys()]))
          .orderBy(
            asc(paymentTransactions.createdAt),
            asc(paymentTransactions.id),
          )
  const paymentsBySale = Map.groupBy(payments, ({ saleId }) => saleId)

  return [...bySale.values()].flatMap((ofSale) => {
    const [first] = ofSale

    return first === undefined
      ? []
      : [
          {
            sale: first.sale,
            details: ofSale.flatMap(({ detail }) =>
              detail === null ? [] : [detail],
            ),
            payments: paymentsBySale.get(first.sale.id) ?? [],
          },
        ]
  })
}

/** The sale with the ID that the reader reaches, with its lines and payments. */
const saleOf = async (
  tx: DatabaseExecutor,
  id: SaleId,
  reach: LedgerReach,
): Promise<SaleWithDetails | null> => {
  const [found] = await gathered(
    tx,
    await tx
      .select({ sale: sales, detail: salesDetails })
      .from(sales)
      .leftJoin(salesDetails, eq(salesDetails.saleId, sales.id))
      .where(and(eq(sales.id, id), within(reach)))
      .orderBy(asc(salesDetails.sortOrder)),
  )

  return found ?? null
}

export class SaleRepository implements ISaleRepository {
  constructor(private readonly db: Database) {}

  async create(
    request: SaleCreateRequest,
    origin: SaleOrigin,
  ): Promise<Result<SaleCreation, DomainError>> {
    return attempt('Failed to create sale', () =>
      this.db.transaction(
        async (tx): Promise<SaleCreation> => {
          const plan = planSale(
            request,
            await referencesOf(tx, request),
            origin,
          )

          return plan.type === 'planned' ? written(tx, plan.write) : plan
        },
        // Each statement sees what was committed before it: a request that
        // waited for the booking sees the sale it waited for. With a
        // snapshot of the whole transaction it would not, and the booking
        // would be billed twice.
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async findById(
    id: SaleId,
    reach: LedgerReach,
  ): Promise<Result<SaleWithDetails | null, DomainError>> {
    return attempt('Failed to find sale', () =>
      this.db.transaction((tx) => saleOf(tx, id, reach), AT_ONE_MOMENT),
    )
  }

  async update(
    id: SaleId,
    reach: LedgerReach,
    request: SaleUpdateRequest,
  ): Promise<Result<SaleUpdate, DomainError>> {
    return attempt('Failed to update sale', () =>
      this.db.transaction(
        async (tx): Promise<SaleUpdate> => {
          const held = await heldSaleOf(tx, id, reach)
          if (held === null) {
            return { type: 'notFound' }
          }
          const refusal = refusalOfChange(held.sale, request)
          if (refusal !== null) {
            return refusal
          }
          const plan = planSaleChange(
            held.sale,
            request,
            await changeReferencesOf(tx, held, request),
          )
          if (plan.type !== 'planned') {
            return plan
          }

          await tx
            .update(sales)
            .set({ ...plan.change.sale, updatedAt: CLOCK })
            .where(eq(sales.id, id))
          if (plan.change.details !== null) {
            await tx.delete(salesDetails).where(eq(salesDetails.saleId, id))
            await tx.insert(salesDetails).values(
              plan.change.details.map((detail) => ({
                ...detail,
                saleId: id,
              })),
            )
          }
          // The sale is held: no payment of it comes in between the
          // statements of this read.
          const sale = await saleOf(tx, id, reach)

          return sale === null
            ? { type: 'notFound' }
            : { type: 'updated', sale }
        },
        // Each statement sees what was committed before it: a request that
        // waited for the sale or for the booking sees what it waited for.
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async voidSale(
    id: SaleId,
    reach: LedgerReach,
    request: SaleVoidRequest,
  ): Promise<Result<SaleVoiding, DomainError>> {
    return attempt('Failed to void sale', () =>
      this.db.transaction(
        async (tx): Promise<SaleVoiding> => {
          const held = await heldSaleOf(tx, id, reach)
          if (held === null) {
            return { type: 'notFound' }
          }
          // A statement of its own after the lock: a payment that was
          // being written when the sale was asked for is among these.
          const payments = await tx
            .select({ status: paymentTransactions.status })
            .from(paymentTransactions)
            .where(eq(paymentTransactions.saleId, id))
          const refusal = refusalOfVoid(held.sale, payments)
          if (refusal !== null) {
            return refusal
          }

          await tx
            .update(sales)
            .set({
              isVoid: true,
              voidedAt: CLOCK,
              voidReason: request.voidReason,
              updatedAt: CLOCK,
            })
            .where(eq(sales.id, id))
          const sale = await saleOf(tx, id, reach)

          return sale === null ? { type: 'notFound' } : { type: 'voided', sale }
        },
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async list({
    reach,
    limit,
    after,
    salonId,
    customerId,
    bookingId,
    paymentStatus,
    startDate,
    endDate,
  }: SaleListCriteria): Promise<Result<SaleList | null, DomainError>> {
    const filters = and(
      within(reach),
      salonId === null ? undefined : eq(sales.salonId, salonId),
      customerId === null ? undefined : eq(sales.customerId, customerId),
      bookingId === null ? undefined : eq(sales.bookingId, bookingId),
      paymentStatus === null
        ? undefined
        : eq(sales.paymentStatus, paymentStatus),
      startDate === null
        ? undefined
        : sql`${sales.saleDate} >= ${startDate}::date`,
      endDate === null ? undefined : sql`${sales.saleDate} <= ${endDate}::date`,
    )

    return attempt('Failed to list sales', () =>
      this.db.transaction(async (tx): Promise<SaleList | null> => {
        // Keyset pagination on (saleTime, id), downwards: the page starts
        // after the sale the cursor names, which has to be one the reader
        // reaches; otherwise the answer would tell that the ID is a sale.
        const [cursor] =
          after === null
            ? []
            : await tx
                .select({ saleTime: sales.saleTime, id: sales.id })
                .from(sales)
                .where(and(eq(sales.id, after), within(reach)))
        if (after !== null && cursor === undefined) {
          return null
        }
        const afterCursor =
          cursor === undefined
            ? undefined
            : sql`(${sales.saleTime}, ${sales.id}) < (${cursor.saleTime}::timestamptz, ${cursor.id}::uuid)`

        const page = tx
          .select()
          .from(sales)
          .where(and(filters, afterCursor))
          .orderBy(desc(sales.saleTime), desc(sales.id))
          // One extra row tells whether another page follows.
          .limit(limit + 1)
          .as('page')
        const rows = await tx
          .select()
          .from(page)
          .leftJoin(salesDetails, eq(salesDetails.saleId, page.id))
          .orderBy(
            desc(page.saleTime),
            desc(page.id),
            asc(salesDetails.sortOrder),
          )
        const found = await gathered(
          tx,
          rows.map((row) => ({ sale: row.page, detail: row.sales_details })),
        )
        const [matching] = await tx
          .select({ total: count() })
          .from(sales)
          .where(filters)

        return {
          sales: found.slice(0, limit),
          total: matching?.total ?? 0,
          hasMore: found.length > limit,
        }
      }, AT_ONE_MOMENT),
    )
  }
}
