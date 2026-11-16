import type { SaleWithDetails } from '../../../models/sale'
import { moneyOf } from '../../payment/_shared/plan'

/**
 * A receipt is the paper of a sale that was paid: the sale with its lines
 * and its payments, under the number of the sale. It is not kept; it is
 * made again from the sale whenever it is asked for.
 */

/**
 * Why a sale has no receipt:
 * - `void`: the sale was voided
 * - `notPaidInFull`: what was received does not come to its total
 */
export type ReceiptRefusal = { type: 'void' } | { type: 'notPaidInFull' }

/**
 * Why a sale has no receipt; null for a sale that has one. What was
 * received counts whatever was given back of it since, so a sale that was
 * paid and then refunded has a receipt, with the refunds on it, and a sale
 * of nothing has one without a payment.
 */
export const refusalOfReceipt = ({
  sale,
  payments,
}: Pick<SaleWithDetails, 'sale' | 'payments'>): ReceiptRefusal | null => {
  if (sale.isVoid) {
    return { type: 'void' }
  }

  return moneyOf(payments).received < sale.totalAmount
    ? { type: 'notPaidInFull' }
    : null
}
