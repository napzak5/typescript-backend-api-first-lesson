import { match, P } from 'ts-pattern'

/**
 * What a failed query leaves for the log: the statement and the server's
 * verdict. The bound values, and the `detail` in which PostgreSQL repeats
 * them, are left out because they are the data of customers.
 */
export type DatabaseFailure = {
  message: string
  /** SQLSTATE, or the driver's code for a connection failure. */
  code: string | null
  constraint: string | null
  table: string | null
  column: string | null
  /** The statement with placeholders; null when no statement was involved. */
  query: string | null
}

/** drizzle wraps the driver's error and keeps the statement beside it. */
const failedQuery = { query: P.string, params: P.array() }

export const describeDatabaseError = (error: unknown): DatabaseFailure => {
  // The message of drizzle's own error lists the bound values.
  const driverError = match(error)
    .with({ ...failedQuery, cause: P.select() }, (cause) => cause)
    .with(failedQuery, () => null)
    .otherwise(() => error)

  return {
    message: match(driverError)
      .with({ message: P.string }, ({ message }) => message)
      .otherwise(() => 'Database query failed'),
    code: match(driverError)
      .with({ code: P.string }, ({ code }) => code)
      .otherwise(() => null),
    constraint: match(driverError)
      .with({ constraint_name: P.string }, (found) => found.constraint_name)
      .otherwise(() => null),
    table: match(driverError)
      .with({ table_name: P.string }, (found) => found.table_name)
      .otherwise(() => null),
    column: match(driverError)
      .with({ column_name: P.string }, (found) => found.column_name)
      .otherwise(() => null),
    query: match(error)
      .with(failedQuery, ({ query }) => query)
      .otherwise(() => null),
  }
}
