import { differenceInMinutes, format, isValid, max, min } from 'date-fns'
import type { DbBookingSummary } from '../../../models/booking'
import type { DbSalon } from '../../../models/salon'
import { inTimeZone, MAX_INTEGER } from '../../../schemas/rules'

/**
 * What a booking says of its service lines taken together.
 *
 * The visit begins with the earliest line and ends with the latest one, on
 * the day the beginning is in the time zone of the salon. It costs what
 * the lines cost, and the consumption tax of the salon is added to the
 * lines whose price does not include it. A booking is summed up when it is
 * entered and again whenever a line is added to it or removed from it.
 */

/** What a booking takes from its salon. */
export type SalonOfBooking = Pick<DbSalon, 'timezone' | 'taxRate'>

/** A service line as far as its booking is summed up from it, with its times as moments. */
export type SummedLine = {
  startTime: Date
  endTime: Date
  price: number
  discountAmount: number
  finalPrice: number
  taxIncluded: boolean
}

/**
 * - `summarized`: what the booking says of its lines
 * - `timeZoneUnknown`: the salon has a time zone the runtime does not
 *   know, so the day of the visit cannot be told
 * - `amountsTooBig`: the amounts are more than a booking can hold
 */
export type BookingSummary =
  | { type: 'summarized'; booking: DbBookingSummary }
  | { type: 'timeZoneUnknown' }
  | { type: 'amountsTooBig' }

/** A percentage of the `numeric(5, 2)` column, in hundredths of a percent. */
const hundredthsOf = (percentage: string): bigint =>
  BigInt(Math.round(Number(percentage) * 100))

/**
 * The consumption tax that is added to an amount without tax: the amount
 * times the rate, with the fraction of a yen dropped. It is computed once
 * for the sum of a booking and not for every line, the way the tax of an
 * invoice is rounded once for each rate.
 */
const taxAddedTo = (amount: number, taxRate: string): number =>
  Number((BigInt(amount) * hundredthsOf(taxRate)) / 10_000n)

const sumOf = (amounts: readonly number[]): number =>
  amounts.reduce((sum, amount) => sum + amount, 0)

/** Sums a booking up from its service lines, of which it has at least one. */
export const summarize = (
  lines: readonly [SummedLine, ...SummedLine[]],
  salon: SalonOfBooking,
): BookingSummary => {
  const startTime = min(lines.map((line) => line.startTime))
  const endTime = max(lines.map((line) => line.endTime))
  const visit = inTimeZone(startTime, salon.timezone)
  if (!isValid(visit)) {
    return { type: 'timeZoneUnknown' }
  }

  const subtotal = sumOf(lines.map(({ price }) => price))
  const discountAmount = sumOf(lines.map((line) => line.discountAmount))
  const taxAmount = taxAddedTo(
    sumOf(
      lines
        .filter(({ taxIncluded }) => !taxIncluded)
        .map(({ finalPrice }) => finalPrice),
    ),
    salon.taxRate,
  )
  const totalAmount = subtotal - discountAmount + taxAmount
  if (subtotal > MAX_INTEGER || totalAmount > MAX_INTEGER) {
    return { type: 'amountsTooBig' }
  }

  return {
    type: 'summarized',
    booking: {
      bookingDate: format(visit, 'yyyy-MM-dd'),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: differenceInMinutes(endTime, startTime),
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
    },
  }
}
