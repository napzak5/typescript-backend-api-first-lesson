import {
  bookingServices,
  bookings,
  customers,
  paymentTransactions,
  sales,
  salons,
  services,
  staff,
} from '@beauty-salon-backend/database'
import type {
  CustomerId,
  CustomerStatisticsLookup,
  CustomerStatisticsPeriod,
  DbBooking,
  DomainError,
  ICustomerStatisticsRepository,
} from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import {
  and,
  count,
  countDistinct,
  eq,
  gte,
  isNotNull,
  isNull,
  lte,
  type SQLWrapper,
  sql,
} from 'drizzle-orm'
import type { PgTransactionConfig } from 'drizzle-orm/pg-core'
import { attempt } from '../database/attempt'
import type { Database, DatabaseExecutor } from '../database/index'

/**
 * The figures of the statistics are read in one snapshot, so that the
 * bookings and the sales are of the same moment. Nothing is written and
 * nothing is locked, as for a sales report.
 */
const AT_ONE_MOMENT: PgTransactionConfig = {
  isolationLevel: 'repeatable read',
  accessMode: 'read only',
}

const COMPLETED: DbBooking['status'] = 'completed'
const CANCELLED: DbBooking['status'] = 'cancelled'
const NO_SHOW: DbBooking['status'] = 'no_show'

/** How many rows meet a condition. */
const countWhere = (condition: SQLWrapper) =>
  sql<number>`count(*) filter (where ${condition})`.mapWith(Number)

/** A sum of an `integer` expression, which PostgreSQL returns as a `bigint`; 0 of no rows. */
const sumOf = (expression: SQLWrapper) =>
  sql<number>`coalesce(sum(${expression}), 0)`.mapWith(Number)

/** The sum of the rows that meet a condition. */
const sumWhere = (expression: SQLWrapper, condition: SQLWrapper) =>
  sql<number>`coalesce(sum(${expression}) filter (where ${condition}), 0)`.mapWith(
    Number,
  )

const statisticsOf = async (
  tx: DatabaseExecutor,
  customerId: CustomerId,
  { salonId, startDate, endDate }: CustomerStatisticsPeriod,
): Promise<CustomerStatisticsLookup> => {
  const [salon] = await tx
    .select({ id: salons.id })
    .from(salons)
    .where(and(eq(salons.id, salonId), isNull(salons.deletedAt)))
  if (salon === undefined) {
    return { type: 'salonNotFound' }
  }
  const [customer] = await tx
    .select({
      loyaltyPoints: customers.loyaltyPoints,
      createdAt: customers.createdAt,
    })
    .from(customers)
    .where(and(eq(customers.id, customerId), isNull(customers.deletedAt)))
  if (customer === undefined) {
    return { type: 'customerNotFound' }
  }

  // The bookings of the customer at the salon whose day is in the period.
  const ofPeriod = and(
    eq(bookings.salonId, salonId),
    eq(bookings.customerId, customerId),
    gte(bookings.bookingDate, startDate),
    lte(bookings.bookingDate, endDate),
  )
  const completed = and(ofPeriod, eq(bookings.status, COMPLETED))
  const [booked] = await tx
    .select({
      bookings: count(),
      cancelled: countWhere(eq(bookings.status, CANCELLED)),
      noShows: countWhere(eq(bookings.status, NO_SHOW)),
      lastVisit: sql<
        string | null
      >`max(${bookings.startTime}) filter (where ${eq(bookings.status, COMPLETED)})`,
    })
    .from(bookings)
    .where(ofPeriod)

  // The sales of the customer at the salon whose day is in the period and
  // that are not void. A payment has a refund amount only while it is
  // refunded in full or in part, so what was refunded of a sale is the sum
  // of the refund amounts of its payments.
  const ofSales = and(
    eq(sales.salonId, salonId),
    eq(sales.customerId, customerId),
    eq(sales.isVoid, false),
    gte(sales.saleDate, startDate),
    lte(sales.saleDate, endDate),
  )
  const refundsOfSale = tx
    .select({
      saleId: paymentTransactions.saleId,
      refunds: sql<number>`sum(${paymentTransactions.refundAmount})`.as(
        'refunds',
      ),
    })
    .from(paymentTransactions)
    .innerJoin(sales, eq(sales.id, paymentTransactions.saleId))
    .where(ofSales)
    .groupBy(paymentTransactions.saleId)
    .as('refunds_of_sale')
  const net = sql`${sales.totalAmount} - coalesce(${refundsOfSale.refunds}, 0)`
  const ofBooking = isNotNull(sales.bookingId)
  const [spending] = await tx
    .select({
      spent: sumOf(net),
      bookingSpent: sumWhere(net, ofBooking),
      bookingSales: countWhere(ofBooking),
    })
    .from(sales)
    .leftJoin(refundsOfSale, eq(refundsOfSale.saleId, sales.id))
    .where(ofSales)

  const serviceRows = await tx
    .select({
      serviceId: services.id,
      name: services.name,
      bookingCount: countDistinct(bookings.id),
    })
    .from(bookingServices)
    .innerJoin(bookings, eq(bookings.id, bookingServices.bookingId))
    .innerJoin(services, eq(services.id, bookingServices.serviceId))
    .where(completed)
    .groupBy(services.id, services.name)
  const staffRows = await tx
    .select({
      staffId: staff.id,
      displayName: staff.displayName,
      bookingCount: count(),
    })
    .from(bookings)
    .innerJoin(staff, eq(staff.id, bookings.staffId))
    .where(completed)
    .groupBy(staff.id, staff.displayName)

  // An aggregate without GROUP BY gives one row, also of no rows.
  return {
    type: 'found',
    figures: {
      bookings: booked?.bookings ?? 0,
      cancelled: booked?.cancelled ?? 0,
      noShows: booked?.noShows ?? 0,
      spent: spending?.spent ?? 0,
      bookingSpent: spending?.bookingSpent ?? 0,
      bookingSales: spending?.bookingSales ?? 0,
      lastVisit: booked?.lastVisit ?? null,
      services: serviceRows,
      staff: staffRows,
      loyaltyPoints: customer.loyaltyPoints,
      customerSince: customer.createdAt,
    },
  }
}

export class CustomerStatisticsRepository
  implements ICustomerStatisticsRepository
{
  constructor(private readonly db: Database) {}

  async findStatistics(
    customerId: CustomerId,
    period: CustomerStatisticsPeriod,
  ): Promise<Result<CustomerStatisticsLookup, DomainError>> {
    return attempt('Failed to read the statistics of a customer', () =>
      this.db.transaction(
        (tx) => statisticsOf(tx, customerId, period),
        AT_ONE_MOMENT,
      ),
    )
  }
}
