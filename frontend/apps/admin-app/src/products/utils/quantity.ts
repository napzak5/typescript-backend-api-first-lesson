import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'

/*
 * A quantity of a product (in stock, moved, counted, ordered), as the API
 * keeps it: a number with two decimals at most.
 */

/** A quantity in hundredths: a whole number, which adds up and compares without the errors of fractions */
export const hundredthsOf = (quantity: number): number =>
  Math.round(quantity * 100)

/** A quantity as it is written, with the decimals the API keeps: 「12.5」. */
export const quantityOf = (quantity: number): LocalizedText =>
  formats.numberOf(quantity, { most: 2 })
