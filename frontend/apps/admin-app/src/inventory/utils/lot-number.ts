import { tooLongError, tooLongOf } from '@beauty-salon-frontend/fields'

/*
 * The lot number of a row of the stock: how long the API takes it, in the
 * form of a row and where the view of the stock looks for a lot.
 */

/** The longest lot number the API takes */
export const LONGEST_LOT = 100

/** What is said of a lot number that is longer than the API takes */
export const LOT_TOO_LONG = tooLongOf('ロット番号', LONGEST_LOT)

/** What is wrong with a lot number that was written, whatever its product: none when nothing is. */
export const lotLengthError = (lot: string): string | undefined =>
  tooLongError(lot, LONGEST_LOT, LOT_TOO_LONG)
