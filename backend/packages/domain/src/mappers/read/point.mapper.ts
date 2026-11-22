import { PointReferenceTypeSchema } from '@beauty-salon-backend/generated'
import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type { ExpiringPoints } from '../../business-logic/point/_shared/lots'
import type { CustomerId } from '../../models/customer'
import type { ApiPage, Paging } from '../../models/page'
import type {
  ApiPointBalanceResponse,
  ApiPointExpireResponse,
  ApiPointExpiringResponse,
  ApiPointTransactionResponse,
  DbPointTransaction,
  PointTransactionId,
} from '../../models/point'
import type {
  PointExpiryOutcome,
  PointListing,
} from '../../repositories/point.repository'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { timestampSchema } from './columns'
import { toApiPage } from './page'

/**
 * Database row → API response. Property names are the column names; what
 * changes is the representation of two columns:
 * - `timestamptz` is read in PostgreSQL's text format and returned as ISO 8601
 * - `referenceType` is text in the database and one of the values of the API
 */

const convertedColumnsSchema = z.object({
  referenceType: PointReferenceTypeSchema.nullable(),
  createdAt: timestampSchema,
}) satisfies z.ZodType<
  Pick<ApiPointTransactionResponse, 'referenceType' | 'createdAt'>
>

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

  /** The point transactions a list found as a page of it. */
  toApiPointTransactionPage(
    { transactions, total, hasMore }: Extract<PointListing, { type: 'listed' }>,
    paging: Paging<PointTransactionId>,
  ): Result<ApiPage<ApiPointTransactionResponse>, DomainError> {
    return Result.map(
      PointReadMapper.toApiPointTransactions(transactions),
      (data) => toApiPage(data, { total, hasMore }, paging),
    )
  },

  /** The balance of a customer. */
  toApiPointBalance(
    customerId: CustomerId,
    balance: number,
  ): ApiPointBalanceResponse {
    return { customerId, balance }
  },

  /**
   * The points of a customer whose expiry date is near: what is left of
   * them, the earliest of their expiry dates, and the earnings they are
   * left of.
   */
  toApiExpiringPoints(
    customerId: CustomerId,
    { expiringPoints, expirationDate, transactions }: ExpiringPoints,
  ): Result<ApiPointExpiringResponse, DomainError> {
    return Result.map(
      PointReadMapper.toApiPointTransactions(transactions),
      (earnings) => ({
        customerId,
        expiringPoints,
        expirationDate,
        transactions: earnings,
      }),
    )
  },

  /** What an expiry did: how many point transactions it wrote, and the points they took. */
  toApiPointExpiry({
    processedCount,
    totalPoints,
  }: Extract<PointExpiryOutcome, { type: 'expired' }>): ApiPointExpireResponse {
    return { processedCount, totalPoints }
  },
}
