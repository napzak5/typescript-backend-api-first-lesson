/**
 * The stock levels of a product: the least stock to keep, the stock at
 * which to order, and the most stock to keep. A level that is null is not
 * set.
 */
export type StockLevels = {
  minimumStock: number
  reorderPoint: number | null
  maximumStock: number | null
}

export type StockLevel = keyof StockLevels

/** Two levels of which the first is not to be above the second. */
export type StockLevelOrder = readonly [StockLevel, StockLevel]

/**
 * The orders the levels keep among those that are set. Ordering only once
 * the stock is below its minimum would not keep the minimum, and ordering
 * above the maximum would take every delivery over it.
 */
const ORDERS: readonly StockLevelOrder[] = [
  ['minimumStock', 'reorderPoint'],
  ['minimumStock', 'maximumStock'],
  ['reorderPoint', 'maximumStock'],
]

/**
 * The orders that the levels break. A level that is not given (undefined)
 * or not set (null) is not compared.
 */
export const brokenOrders = (
  levels: Partial<Record<StockLevel, number | null>>,
): StockLevelOrder[] =>
  ORDERS.filter(([lower, upper]) => {
    const below = levels[lower]
    const above = levels[upper]
    return (
      below !== undefined &&
      below !== null &&
      above !== undefined &&
      above !== null &&
      below > above
    )
  })

/**
 * The levels a product has after a change: those the change names, and of
 * the others what the product had. A change that names null takes a level
 * away.
 */
export const stockLevelsAfter = (
  current: StockLevels,
  changes: Partial<StockLevels>,
): StockLevels => ({
  minimumStock:
    changes.minimumStock === undefined
      ? current.minimumStock
      : changes.minimumStock,
  reorderPoint:
    changes.reorderPoint === undefined
      ? current.reorderPoint
      : changes.reorderPoint,
  maximumStock:
    changes.maximumStock === undefined
      ? current.maximumStock
      : changes.maximumStock,
})

/** A level that is out of order, under the name of the level. */
export type StockLevelIssue = { field: StockLevel; message: string }

/**
 * The levels a request is told about for the orders it breaks. Of an order
 * whose two levels the request names, the upper one is out of order; of an
 * order of which the request names one level, that one, since the other is
 * what the product has.
 */
export const stockLevelIssues = (
  broken: readonly StockLevelOrder[],
  named: (level: StockLevel) => boolean,
): StockLevelIssue[] =>
  broken.map(([lower, upper]) =>
    named(upper)
      ? { field: upper, message: `Must not be less than ${lower}` }
      : { field: lower, message: `Must not be more than ${upper}` },
  )
