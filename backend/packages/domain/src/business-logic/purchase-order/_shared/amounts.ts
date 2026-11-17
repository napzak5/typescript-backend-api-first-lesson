import { MAX_INTEGER } from '../../../schemas/rules'
import {
  largestUnitCostOf,
  totalCostOf,
} from '../../inventory/_shared/movements'

/**
 * The amounts of a purchase order, in yen. The server works them out from
 * what is ordered, so that they agree with each other as the database
 * checks them: an item comes to its quantity times its unit price, rounded
 * to the yen; the subtotal is what the items come to; the total is the
 * subtotal with the tax and the shipping cost (none when there is none).
 * Each of them is held by an `integer` column, which the request is held
 * to before they are written.
 */

/**
 * What an item comes to: its quantity times its unit price, rounded half
 * up to the yen as PostgreSQL rounds a `numeric`. It is worked out exactly,
 * as a stock movement's total cost is.
 */
export const totalPriceOf = (unitPrice: number, quantity: number): bigint =>
  totalCostOf(unitPrice, quantity)

/** The largest unit price at which an item of the quantity fits an `integer` column. */
export const largestUnitPriceOf = (quantity: number): number =>
  Number(largestUnitCostOf(quantity, MAX_INTEGER))

type OrderedItem = { quantity: number; unitPrice: number }

/**
 * The subtotal and the total of an order of the items at the tax and the
 * shipping cost, worked out exactly.
 */
export const amountsOf = (
  items: readonly OrderedItem[],
  taxAmount: number,
  shippingCost: number | null,
): { subtotal: bigint; totalAmount: bigint } => {
  const subtotal = items.reduce(
    (sum, { unitPrice, quantity }) => sum + totalPriceOf(unitPrice, quantity),
    0n,
  )

  return {
    subtotal,
    totalAmount: subtotal + BigInt(taxAmount) + BigInt(shippingCost ?? 0),
  }
}
