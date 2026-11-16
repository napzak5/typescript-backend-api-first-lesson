import { PointReferenceTypeSchema } from '@beauty-salon-backend/generated'
import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiPointTransactionResponse,
  DbPointTransaction,
} from '../../models/point'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { timestampSchema } from './columns'

/**
 * Database row → API response. Property names are the column names; what
 * changes is the representation of two columns:
 * - `timestamptz` is read in PostgreSQL's text format and returned as ISO 8601
 * - `referenceType` is text in the database and one of the values of the API
 */

const convertedColumnsSchema = z.object({
  referenceType: PointReferenceTypeSchema.nullable(),
  createdAt: timestampSchema,
})

const toApiPointTransaction = (
  transaction: DbPointTransaction,
): Result<ApiPointTransactionResponse, DomainError> =>
  Result.mapError(
    Result.map(
      parseWith(
        convertedColumnsSchema,
        transaction,
        'Invalid stored point transaction',
      ),
      (converted) => ({ ...transaction, ...converted }),
    ),
    // The request was fine; the stored row is not.
    (error) =>
      DomainErrors.database(
        `Stored point transaction ${transaction.id} does not match the API model`,
        error,
      ),
  )

export const PointReadMapper = {
  toApiPointTransaction,

  toApiPointTransactions(
    transactions: DbPointTransaction[],
  ): Result<ApiPointTransactionResponse[], DomainError> {
    const apiTransactions: ApiPointTransactionResponse[] = []
    for (const transaction of transactions) {
      const mapped = toApiPointTransaction(transaction)
      if (mapped.type === 'error') {
        return mapped
      }
      apiTransactions.push(mapped.data)
    }
    return Result.success(apiTransactions)
  },
}
