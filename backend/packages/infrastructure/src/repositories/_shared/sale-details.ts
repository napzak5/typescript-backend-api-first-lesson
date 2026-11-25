import {
  paymentTransactions,
  salesDetails,
} from '@beauty-salon-backend/database'
import type {
  DbPaymentTransaction,
  DbSale,
  DbSalesDetail,
  SaleWithDetails,
} from '@beauty-salon-backend/domain'
import { asc, eq, inArray } from 'drizzle-orm'
import type { DatabaseExecutor } from '../../database/index'

/** The payments made for the sales, in the order they were made. */
const paymentsOf = (
  tx: DatabaseExecutor,
  saleIds: readonly string[],
): Promise<DbPaymentTransaction[]> =>
  tx
    .select()
    .from(paymentTransactions)
    .where(inArray(paymentTransactions.saleId, [...saleIds]))
    .orderBy(asc(paymentTransactions.createdAt), asc(paymentTransactions.id))

/**
 * The sales of the rows of a join of sales and their lines, in the order
 * the rows have, each with the payments made for it, in the order they
 * were made.
 */
export const salesWithDetails = async (
  tx: DatabaseExecutor,
  rows: readonly { sale: DbSale; detail: DbSalesDetail | null }[],
): Promise<SaleWithDetails[]> => {
  // A map keeps its keys in the order they were first set: each sale is
  // where its first row is.
  const bySale = new Map<string, { sale: DbSale; details: DbSalesDetail[] }>()
  for (const { sale, detail } of rows) {
    const gathered = bySale.get(sale.id) ?? { sale, details: [] }
    if (detail !== null) {
      gathered.details.push(detail)
    }
    bySale.set(sale.id, gathered)
  }
  if (bySale.size === 0) {
    return []
  }

  const payments = Map.groupBy(
    await paymentsOf(tx, [...bySale.keys()]),
    ({ saleId }) => saleId,
  )
  return [...bySale.values()].map((gathered) => ({
    ...gathered,
    payments: payments.get(gathered.sale.id) ?? [],
  }))
}

/**
 * A sale that was written, with its lines in their order and the payments
 * made for it. `details` are the lines when the write wrote them, and are
 * read otherwise.
 */
export const saleWithDetailsOf = async (
  tx: DatabaseExecutor,
  sale: DbSale,
  details: readonly DbSalesDetail[] | null,
): Promise<SaleWithDetails> => ({
  sale,
  details:
    details === null
      ? await tx
          .select()
          .from(salesDetails)
          .where(eq(salesDetails.saleId, sale.id))
          .orderBy(asc(salesDetails.sortOrder))
      : details.toSorted((a, b) => a.sortOrder - b.sortOrder),
  payments: await paymentsOf(tx, [sale.id]),
})
