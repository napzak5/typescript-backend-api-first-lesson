import { type DomainError, DomainErrors } from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'

/*
 * A write with `RETURNING` answers with the row it wrote. It answers with
 * none when a trigger of the table skipped the row (a `BEFORE` trigger that
 * returns NULL): then nothing was written, and that is a failure of the
 * database, not of the request. `write` names the statement in the log
 * (`Insert of salon`).
 */

const noRow = (write: string): Result<never, DomainError> =>
  Result.error(DomainErrors.database(`${write} returned no row`, null))

/** What a write made of the row it wrote, or a failure when the row was not written (`null`). */
export const written =
  (write: string) =>
  <T>(made: T | null): Result<T, DomainError> =>
    made === null ? noRow(write) : Result.success(made)

/** The row a write returned, or a failure when it returned none. */
export const rowWritten =
  (write: string) =>
  <T>(rows: readonly T[]): Result<T, DomainError> => {
    const [row] = rows
    return row === undefined ? noRow(write) : Result.success(row)
  }

/**
 * Each of the items a write was to write a row for, with the row it
 * returned for it, in the order of the items; a failure when it returned
 * no row for one of them. `keyOf` names an item, and `rowKeyOf` the item a
 * row is for.
 */
export const writtenFor =
  (write: string) =>
  <Item, Row>(
    items: readonly Item[],
    keyOf: (item: Item) => string,
    rows: readonly Row[],
    rowKeyOf: (row: Row) => string | null,
  ): Result<{ item: Item; row: Row }[], DomainError> => {
    const rowOf = new Map(rows.map((row) => [rowKeyOf(row), row]))
    const paired = items.flatMap((item) => {
      const row = rowOf.get(keyOf(item))
      return row === undefined ? [] : [{ item, row }]
    })
    return paired.length < items.length
      ? Result.error(
          DomainErrors.database(
            `${write} returned no row for ${items.length - paired.length} of ${items.length}`,
            null,
          ),
        )
      : Result.success(paired)
  }
