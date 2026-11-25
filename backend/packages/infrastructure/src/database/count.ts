/**
 * The number that a query of `count()` answered with. Without `GROUP BY`,
 * such a query answers with one row, whatever it counts and however many
 * rows match; the number is the sum over the rows it answered with, which
 * is the count of that one row.
 */
export const totalOf = (counted: readonly { total: number }[]): number =>
  counted.reduce((sum, { total }) => sum + total, 0)
