import { compareText } from '../../sales-report/_shared/report'

/** How many services and staff members the statistics name. */
export const FAVORITES = 5

/** The most booked first, then by ID; the first `FAVORITES`. */
export const favorites = <T extends { bookingCount: number }>(
  rows: readonly T[],
  idOf: (row: T) => string,
): T[] =>
  [...rows]
    .sort(
      (first, second) =>
        second.bookingCount - first.bookingCount ||
        compareText(idOf(first), idOf(second)),
    )
    .slice(0, FAVORITES)
