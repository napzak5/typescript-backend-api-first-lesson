import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiCustomerDeletionRequestResponse,
  DbCustomerDeletionRequest,
} from '../../models/customer-deletion-request'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { timestampSchema } from './columns'

/**
 * Database row → API response: property names are the column names, and
 * only the times are written as the API writes them.
 */

const convertedColumnsSchema = z.object({
  requestedAt: timestampSchema,
  scheduledAt: timestampSchema,
  cancelledAt: timestampSchema.nullable(),
  completedAt: timestampSchema.nullable(),
})

const toApiCustomerDeletionRequest = (
  request: DbCustomerDeletionRequest,
): Result<ApiCustomerDeletionRequestResponse, DomainError> =>
  Result.mapError(
    Result.map(
      parseWith(
        convertedColumnsSchema,
        request,
        'Invalid stored customer deletion request',
      ),
      (converted) => ({ ...request, ...converted }),
    ),
    // The request was fine; the stored row is not.
    (error) =>
      DomainErrors.database(
        `Stored customer deletion request ${request.id} does not match the API model`,
        error,
      ),
  )

export const CustomerDeletionRequestReadMapper = {
  toApiCustomerDeletionRequest,
}
