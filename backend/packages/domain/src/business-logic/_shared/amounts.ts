import type { DbService } from '../../models/service'
import { MAX_INTEGER } from '../../schemas/rules'

/**
 * What lines of a bill come to. A line costs its price less its discount;
 * the consumption tax of the salon is added to the lines whose price does
 * not include it. A booking is summed up this way, and so is a sale that
 * is calculated before it is entered.
 */

/** A line as far as a bill is summed up from it. */
export type PricedLine = {
  price: number
  discountAmount: number
  finalPrice: number
  taxIncluded: boolean
}

/** What a bill says of its lines taken together. */
export type BillAmounts = {
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
}

/** A percentage of the `numeric(5, 2)` column, in hundredths of a percent. */
const hundredthsOf = (percentage: string): bigint =>
  BigInt(Math.round(Number(percentage) * 100))

/**
 * The consumption tax that is added to an amount without tax: the amount
 * times the rate, with the fraction of a yen dropped. It is computed once
 * for the sum of a bill and not for every line, the way the tax of an
 * invoice is rounded once for each rate.
 */
const taxAddedTo = (amount: number, taxRate: string): number =>
  Number((BigInt(amount) * hundredthsOf(taxRate)) / 10_000n)

const sumOf = (amounts: readonly number[]): number =>
  amounts.reduce((sum, amount) => sum + amount, 0)

/**
 * The line of a service at the price it has now: the discount is what the
 * discounted price takes off the price.
 */
export const pricedLineOf = (
  service: Pick<DbService, 'price' | 'discountPrice' | 'taxIncluded'>,
): PricedLine => {
  const discountAmount =
    service.price - (service.discountPrice ?? service.price)

  return {
    price: service.price,
    discountAmount,
    finalPrice: service.price - discountAmount,
    taxIncluded: service.taxIncluded,
  }
}

/**
 * What lines come to at the tax rate of a salon; null when that is more
 * than an `integer` column holds.
 */
export const amountsOf = (
  lines: readonly PricedLine[],
  taxRate: string,
): BillAmounts | null => {
  const subtotal = sumOf(lines.map(({ price }) => price))
  const discountAmount = sumOf(lines.map((line) => line.discountAmount))
  const taxAmount = taxAddedTo(
    sumOf(
      lines
        .filter(({ taxIncluded }) => !taxIncluded)
        .map(({ finalPrice }) => finalPrice),
    ),
    taxRate,
  )
  const totalAmount = subtotal - discountAmount + taxAmount

  return subtotal > MAX_INTEGER || totalAmount > MAX_INTEGER
    ? null
    : { subtotal, discountAmount, taxAmount, totalAmount }
}
