import { z } from 'zod'
import type { ApiCustomerDeletionRequestCreateRequest } from '../models/customer-deletion-request'
import { nonBlankText } from './rules'

/** The most a reason holds, as the column allows. */
const MOST_REASON_LENGTH = 1000

/** A request to erase the data of a customer says why. */
export const customerDeletionRequestCreateRequestSchema = z.strictObject({
  reason: nonBlankText.max(MOST_REASON_LENGTH),
}) satisfies z.ZodType<ApiCustomerDeletionRequestCreateRequest>
