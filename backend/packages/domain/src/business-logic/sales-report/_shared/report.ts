/**
 * The arithmetic of what a report says, and what the statistics of a
 * customer say with it. The figures are sums the repository read; the read
 * mapper adds them up, divides them and puts them in order with these
 * (`mappers/read/sales-report.mapper.ts`).
 */

/** How many staff members the report of a period names. */
export const TOP_STAFF = 5

/**
 * An amount divided by a count, with the fraction of a yen dropped; 0 when
 * there is nothing to divide by.
 */
export const averageOf = (amount: number, count: number): number =>
  count === 0 ? 0 : Math.floor(amount / count)

/** A part of a whole in per cent, to one decimal place; 0 of a whole of 0. */
export const percentageOf = (amount: number, whole: number): number =>
  whole === 0 ? 0 : Math.round((amount * 1000) / whole) / 10

/** Text in the order of its code points: -1, 0 or 1. */
export const compareText = (first: string, second: string): number =>
  Number(first > second) - Number(first < second)
