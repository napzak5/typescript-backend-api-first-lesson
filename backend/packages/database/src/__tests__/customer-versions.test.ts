import { getTableColumns } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import { customers, customerVersions } from '../schema'

/** Columns of `customers` that are not values of the ledger. */
const notOfTheLedger = [
  'id',
  'userId',
  'loyaltyPoints',
  'firstVisitDate',
  'lastVisitDate',
  'visitCount',
  'noShowCount',
  'cancellationCount',
  'deletedAt',
  'createdAt',
  'updatedAt',
]

/** Columns of `customer_versions` that say which write a version was. */
const ofTheWrite = [
  'id',
  'customerId',
  'version',
  'operation',
  'changedBy',
  'changedAt',
]

const shapes = (
  columns: Record<string, PgColumn>,
  leftOut: readonly string[],
) =>
  Object.fromEntries(
    Object.entries(columns)
      .filter(([name]) => !leftOut.includes(name))
      .map(([name, column]) => [
        name,
        {
          type: column.getSQLType(),
          notNull: column.notNull,
          enumValues: column.enumValues ?? null,
        },
      ]),
  )

describe('customer_versions', () => {
  it('keeps every value of the ledger of a customer, with the type and the nullability of its column, and nothing more', () => {
    const ledger = shapes(getTableColumns(customers), notOfTheLedger)
    const kept = shapes(getTableColumns(customerVersions), ofTheWrite)

    expect(Object.keys(ledger)).toHaveLength(30)
    expect(kept).toEqual(ledger)
  })

  it('has no default for a value of the ledger: a version states each of them', () => {
    const withDefault = Object.entries(getTableColumns(customerVersions))
      .filter(
        ([name, column]) => !ofTheWrite.includes(name) && column.hasDefault,
      )
      .map(([name]) => name)

    expect(withDefault).toEqual([])
  })
})
