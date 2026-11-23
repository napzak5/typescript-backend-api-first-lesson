import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiCustomerDeletionRequestResponse,
  DbCustomerDeletionRequest,
} from '../../models/customer-deletion-request'
import { type DomainError, parseStored } from '../../shared'
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
}) satisfies z.ZodType<
  Pick<
    ApiCustomerDeletionRequestResponse,
    'requestedAt' | 'scheduledAt' | 'cancelledAt' | 'completedAt'
  >
>

const toApiCustomerDeletionRequest = (
  request: DbCustomerDeletionRequest,
): Result<ApiCustomerDeletionRequestResponse, DomainError> =>
  Result.map(
    parseStored(
      convertedColumnsSchema,
      request,
      `Stored customer deletion request ${request.id} does not match the API model`,
    ),
    (converted) => ({ ...request, ...converted }),
  )

export const CustomerDeletionRequestReadMapper = {
  toApiCustomerDeletionRequest,
}
