import { paymentTransactions } from '@beauty-salon-backend/database'
import type {
  DbPaymentTransaction,
  DbSale,
  DbSalesDetail,
  SaleWithDetails,
} from '@beauty-salon-backend/domain'
import { asc, inArray } from 'drizzle-orm'
import type { DatabaseExecutor } from '../database/index'

/**
 * The sales of the rows of a join of sales and their lines, in the order
 * the rows have, each with the payments made for it, in the order they
 * were made.
 */
export const salesWithDetails = async (
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
