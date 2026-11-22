/*
 * A quantity of a product (in stock, moved, counted, ordered), as the API
 * keeps it: a number with two decimals at most.
 */

/** A quantity in hundredths: a whole number, which adds up and compares without the errors of fractions */
export const hundredthsOf = (quantity: number): number =>
  Math.round(quantity * 100)
