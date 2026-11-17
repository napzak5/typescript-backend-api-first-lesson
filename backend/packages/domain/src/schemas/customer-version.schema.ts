import { z } from 'zod'
import {
  type ApiCustomerVersionSearchRequest,
  customerVersionIdSchema,
} from '../models/customer-version'

/** The page of the history: the cursor is the ID of a version. */
export const customerVersionSearchRequestSchema = z.strictObject({
  limit: z.number().int().min(1).max(100).exactOptional(),
  cursor: customerVersionIdSchema.exactOptional(),
}) satisfies z.ZodType<ApiCustomerVersionSearchRequest>

/** The largest number of a version, which is an int32 in the API. */
const LAST_VERSION = 2_147_483_647

/** The number of a version, as the path writes it: a whole number from 1. */
export const customerVersionNumberSchema = z.strictObject({
  version: z
    .string()
    .regex(/^\d+$/, 'Must be a whole number')
    .transform(Number)
    .pipe(z.number().int().min(1).max(LAST_VERSION)),
})
