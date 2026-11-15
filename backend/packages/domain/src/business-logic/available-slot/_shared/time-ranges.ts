import { max, min } from 'date-fns'

/** A stretch of time. Its end is not part of it. */
export type TimeRange = {
  from: Date
  until: Date
}

/**
 * The ranges in the order in which they begin, with those that meet or
 * touch made into one. A range that ends where it begins, or before, is
 * no time at all and is left out.
 */
export const joined = (ranges: readonly TimeRange[]): TimeRange[] => {
  const result: TimeRange[] = []
  const inOrder = ranges
    .filter(({ from, until }) => from < until)
    .toSorted((one, other) => one.from.getTime() - other.from.getTime())
  for (const range of inOrder) {
    const last = result.at(-1)
    if (last !== undefined && range.from <= last.until) {
      result.splice(-1, 1, {
        from: last.from,
        until: max([last.until, range.until]),
      })
    } else {
      result.push(range)
    }
  }

  return result
}

/** The time that is in a range of the one list and in a range of the other. */
export const overlapOf = (
  ranges: readonly TimeRange[],
  others: readonly TimeRange[],
): TimeRange[] =>
  joined(
    ranges.flatMap((range) =>
      others.map((other) => ({
        from: max([range.from, other.from]),
        until: min([range.until, other.until]),
      })),
    ),
  )

/** The time of the ranges that is in none of the removed ones. */
export const without = (
  ranges: readonly TimeRange[],
  removed: readonly TimeRange[],
): TimeRange[] =>
  joined(removed).reduce(
    (rest, gone) =>
      joined(
        rest.flatMap((range) => [
          { from: range.from, until: min([range.until, gone.from]) },
          { from: max([range.from, gone.until]), until: range.until },
        ]),
      ),
    joined(ranges),
  )
