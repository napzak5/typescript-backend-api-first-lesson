import {
  paymentMethods,
  paymentTransactions,
  sales,
  salesDetails,
  salons,
  serviceCategories,
  services,
  staff,
} from '@beauty-salon-backend/database'
import {
  type CategoryFigures,
  type DbPaymentTransaction,
  type DomainError,
  type ISalesReportRepository,
  type SalesFigures,
  type SalesPeriod,
  SERVICE_ITEM,
} from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import {
  and,
  count,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  type SQLWrapper,
  sql,
} from 'drizzle-orm'
import type { PgTransactionConfig } from 'drizzle-orm/pg-core'
import { attempt } from '../database/attempt'
import type { Database, DatabaseExecutor } from '../database/index'

/**
 * The figures of a report are read in one snapshot, so that the sums of
 * the days, the payments, the categories and the staff members are of the
 * same sales. Nothing is written and nothing is locked: a sale or a
 * payment that is being written is not waited for, and what was committed
 * when the report began is counted.
 */
const AT_ONE_MOMENT: PgTransactionConfig = {
  isolationLevel: 'repeatable read',
  accessMode: 'read only',
}

/** The statuses of a payment whose amount was received. */
const RECEIVED: DbPaymentTransaction['status'][] = [
  'completed',
  'partial_refund',
  'refunded',
]

/** A sum of an `integer` column, which PostgreSQL returns as a `bigint`. */
const sumOf = (expression: SQLWrapper) =>
  sql<number>`coalesce(sum(${expression}), 0)`.mapWith(Number)

/** The sum of the rows that meet a condition. */
const sumWhere = (expression: SQLWrapper, condition: SQLWrapper) =>
  sql<number>`coalesce(sum(${expression}) filter (where ${condition}), 0)`.mapWith(
    Number,
  )

/** The sales a report counts: those of the salon in the period that are not void. */
const ofPeriod = ({ salonId, startDate, endDate }: SalesPeriod) =>
  and(
    eq(sales.salonId, salonId),
    eq(sales.isVoid, false),
    gte(sales.saleDate, startDate),
    lte(sales.saleDate, endDate),
  )

/** The staff member a line counts for: that of the line, or else that of its sale. */
const staffOfLine = sql`coalesce(${salesDetails.staffId}, ${sales.staffId})`

const isServiceLine = sql`${salesDetails.itemType} = ${SERVICE_ITEM}`

/**
 * A service without a category and a line without a service are counted
 * as `other`, together with the services of a category of that kind.
 */
const mergedCategories = (
  rows: readonly CategoryFigures[],
): CategoryFigures[] =>
  [...new Set(rows.map(({ category }) => category))].map((category) => {
    const ofKind = rows.filter((row) => row.category === category)

    return {
      category,
      amount: ofKind.reduce((sum, { amount }) => sum + amount, 0),
      count: ofKind.reduce((sum, row) => sum + row.count, 0),
    }
  })

const figuresOf = async (
  tx: DatabaseExecutor,
  period: SalesPeriod,
): Promise<SalesFigures | null> => {
  const [salon] = await tx
    .select({ id: salons.id })
    .from(salons)
    .where(and(eq(salons.id, period.salonId), isNull(salons.deletedAt)))
  if (salon === undefined) {
    return null
  }

  // A payment has a refund amount only while it is refunded in full or in
  // part (constraints of payment_transactions), so what was refunded of a
  // sale is the sum of the refund amounts of its payments.
  const refundsOfSale = tx
    .select({
      saleId: paymentTransactions.saleId,
      refunds: sql<number>`sum(${paymentTransactions.refundAmount})`.as(
        'refunds',
      ),
    })
    .from(paymentTransactions)
    .innerJoin(sales, eq(sales.id, paymentTransactions.saleId))
    .where(ofPeriod(period))
    .groupBy(paymentTransactions.saleId)
    .as('refunds_of_sale')
  const days = await tx
    .select({
      saleDate: sales.saleDate,
      sales: sumOf(sales.totalAmount),
      tax: sumOf(sales.taxAmount),
      discounts: sumOf(sales.discountAmount),
      transactions: count(),
      refunds: sumOf(refundsOfSale.refunds),
    })
    .from(sales)
    .leftJoin(refundsOfSale, eq(refundsOfSale.saleId, sales.id))
    .where(ofPeriod(period))
    .groupBy(sales.saleDate)

  const methods = await tx
    .select({
      method: paymentMethods.method,
      amount: sumOf(
        sql`${paymentTransactions.amount} - coalesce(${paymentTransactions.refundAmount}, 0)`,
      ),
      count: count(),
    })
    .from(paymentTransactions)
    .innerJoin(sales, eq(sales.id, paymentTransactions.saleId))
    .innerJoin(
      paymentMethods,
      eq(paymentMethods.id, paymentTransactions.paymentMethodId),
    )
    .where(and(ofPeriod(period), inArray(paymentTransactions.status, RECEIVED)))
    .groupBy(paymentMethods.method)

  const categories = await tx
    .select({
      category: serviceCategories.category,
      amount: sumOf(salesDetails.totalAmount),
      count: sumOf(salesDetails.quantity),
    })
    .from(salesDetails)
    .innerJoin(sales, eq(sales.id, salesDetails.saleId))
    .leftJoin(services, eq(services.id, salesDetails.itemId))
    .leftJoin(serviceCategories, eq(serviceCategories.id, services.categoryId))
    .where(and(ofPeriod(period), isServiceLine))
    .groupBy(serviceCategories.category)

  const staffRows = await tx
    .select({
      staffId: staff.id,
      displayName: staff.displayName,
      totalSales: sumOf(salesDetails.totalAmount),
      serviceSales: sumWhere(salesDetails.totalAmount, isServiceLine),
      serviceCount: sumWhere(salesDetails.quantity, isServiceLine),
    })
    .from(salesDetails)
    .innerJoin(sales, eq(sales.id, salesDetails.saleId))
    .innerJoin(staff, sql`${staff.id} = ${staffOfLine}`)
    .where(ofPeriod(period))
    .groupBy(staff.id, staff.displayName)

  return {
    days,
    methods,
    categories: mergedCategories(
      categories.map((row) => ({ ...row, category: row.category ?? 'other' })),
    ),
    staff: staffRows,
  }
}

export class SalesReportRepository implements ISalesReportRepository {
  constructor(private readonly db: Database) {}

  async findFigures(
    period: SalesPeriod,
  ): Promise<Result<SalesFigures | null, DomainError>> {
    return attempt('Failed to read the figures of a sales report', () =>
      this.db.transaction((tx) => figuresOf(tx, period), AT_ONE_MOMENT),
    )
  }
}
