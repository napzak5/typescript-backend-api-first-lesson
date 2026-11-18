/** What a run of `pnpm db:seed` does to the database. */
export type SeedPlan = 'insert' | 'reset-and-insert' | 'skip' | 'refuse'

export interface SeedRequest {
  /** The database has rows the seed would insert again */
  hasData: boolean
  /** `--reset`: delete all rows first */
  reset: boolean
  /** `--if-empty`: leave a database with data as it is */
  onlyIfEmpty: boolean
}

/**
 * The seed inserts fixed rows, so it cannot be added to data that is already
 * there. A database with data is left alone (`--if-empty`), emptied first
 * (`--reset`), or the run is refused before anything is written.
 */
export const planSeed = ({
  hasData,
  reset,
  onlyIfEmpty,
}: SeedRequest): SeedPlan => {
  if (hasData && onlyIfEmpty) {
    return 'skip'
  }
  if (reset) {
    return 'reset-and-insert'
  }
  return hasData ? 'refuse' : 'insert'
}
