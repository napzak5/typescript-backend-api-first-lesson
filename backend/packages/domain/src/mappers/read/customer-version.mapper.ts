import { CustomerGenderTypeSchema } from '@beauty-salon-backend/generated'
import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiCustomerHistoryEntryResponse,
  ApiCustomerVersionChangeResponse,
  ApiCustomerVersionResponse,
  DbCustomerVersion,
} from '../../models/customer-version'
import type { CustomerVersionWithPrevious } from '../../repositories/customer-version.repository'
import { storedCustomerPreferencesSchema } from '../../schemas/customer.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { timestampSchema } from './columns'

/**
 * Database row → API response, as for a customer: property names are the
 * column names, and the columns whose representation differs (`gender`,
 * `preferences`, the time) are converted as they are for a customer.
 */

const convertedColumnsSchema = z.object({
  gender: CustomerGenderTypeSchema.nullable(),
  preferences: storedCustomerPreferencesSchema.nullable(),
  changedAt: timestampSchema,
})

const toApiCustomerVersion = (
  version: DbCustomerVersion,
): Result<ApiCustomerVersionResponse, DomainError> =>
  Result.mapError(
    Result.map(
      parseWith(
        convertedColumnsSchema,
        version,
        'Invalid stored customer version',
      ),
      (converted) => ({ ...version, ...converted }),
    ),
    // The request was fine; the stored row is not.
    (error) =>
      DomainErrors.database(
        `Stored customer version ${version.id} does not match the API model`,
        error,
      ),
  )

/** The writes whose versions tell what they changed: an update and a merge. */
const CHANGING: ReadonlySet<ApiCustomerVersionResponse['operation']> = new Set([
  'update',
  'merge',
])

/** The properties of a version that say which write it was, not what it wrote. */
const OF_THE_WRITE = new Set([
  'id',
  'customerId',
  'version',
  'operation',
  'changedBy',
  'changedAt',
])

/** The values of the ledger in a version, by property, in the order of the response. */
const ledgerValuesOf = (
  version: ApiCustomerVersionResponse,
): [string, unknown][] =>
  Object.entries(version).filter(([field]) => !OF_THE_WRITE.has(field))

/** The values of the ledger that differ from one version to the next. */
const changesBetween = (
  previous: ApiCustomerVersionResponse,
  current: ApiCustomerVersionResponse,
): ApiCustomerVersionChangeResponse[] => {
  const before = new Map(ledgerValuesOf(previous))
  return ledgerValuesOf(current).flatMap(([field, newValue]) => {
    const oldValue = before.get(field) ?? null
    // The values are as the response writes them: plain data, which JSON
    // writes the same way when they are equal.
    return JSON.stringify(oldValue) === JSON.stringify(newValue)
      ? []
      : [{ field, oldValue, newValue }]
  })
}

const toApiHistoryEntry = ({
  version,
  previous,
}: CustomerVersionWithPrevious): Result<
  ApiCustomerHistoryEntryResponse,
  DomainError
> =>
  Result.flatMap(toApiCustomerVersion(version), (current) =>
    Result.map(
      previous === null || !CHANGING.has(current.operation)
        ? Result.success(null)
        : Result.map(toApiCustomerVersion(previous), (before) =>
            changesBetween(before, current),
          ),
      (changes) => ({
        id: current.id,
        customerId: current.customerId,
        version: current.version,
        operation: current.operation,
        changedBy: current.changedBy,
        changedAt: current.changedAt,
        changes,
      }),
    ),
  )

export const CustomerVersionReadMapper = {
  toApiCustomerVersion,

  toApiHistory(
    versions: CustomerVersionWithPrevious[],
  ): Result<ApiCustomerHistoryEntryResponse[], DomainError> {
    const entries: ApiCustomerHistoryEntryResponse[] = []
    for (const version of versions) {
      const mapped = toApiHistoryEntry(version)
      if (mapped.type === 'error') {
        return mapped
      }
      entries.push(mapped.data)
    }
    return Result.success(entries)
  },
}
