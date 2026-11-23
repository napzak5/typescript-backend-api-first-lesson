import { asOneString } from '@beauty-salon-shared/i18n'
import { customerVersionMessages } from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import {
  type ApiCustomerVersionPathParameters,
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
    .regex(/^\d+$/, asOneString(customerVersionMessages.wholeNumber))
    .transform(Number)
    .pipe(z.number().int().min(1).max(LAST_VERSION)),
}) satisfies z.ZodType<Pick<ApiCustomerVersionPathParameters, 'version'>>

/** A search that was checked: its cursor is the ID of a version. */
export type CustomerVersionSearchRequest = z.infer<
  typeof customerVersionSearchRequestSchema
>
