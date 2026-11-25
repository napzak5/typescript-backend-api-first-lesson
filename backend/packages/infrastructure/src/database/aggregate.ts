/**
 * The row a query of aggregates without `GROUP BY` answered with. Such a
 * query answers with one row, whatever it reads and however many rows
 * match; `none` is what its aggregates are of no rows, the row of a query
 * that answered with none.
 */
export const aggregateOf = <T>(rows: readonly T[], none: T): T => {
  const [row] = rows
  return row ?? none
}
