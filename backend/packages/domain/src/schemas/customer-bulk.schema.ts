import { z } from 'zod'
import {
  type ApiCustomerBatchGetRequest,
  type ApiCustomerBulkCreateRequest,
  type ApiCustomerBulkDeleteRequest,
  type ApiCustomerBulkUpdateRequest,
  customerIdSchema,
} from '../models/customer'
import {
  customerCreateRequestSchema,
  customerUpdateRequestSchema,
} from './customer.schema'
import { noRepeatedEntries } from './rules'

/**
 * The requests that name several customers at once. Each names from one to
 * a hundred, and none twice, so that what the answer lists is the request,
 * one for one and in its order.
 */

/** How many customers one request names at most. */
const AT_MOST = 100

const customerIds = z
  .array(customerIdSchema)
  .min(1)
  .max(AT_MOST)
  .check(noRepeatedEntries)

/**
 * For the items of an update: an item that names the customer of an
 * earlier one is reported at its `id`.
 */
const noRepeatedCustomers = (
  context: z.core.ParsePayload<readonly { id: string }[]>,
): void => {
  const seen = new Set<string>()
  context.value.forEach(({ id }, index) => {
    if (seen.has(id)) {
      context.issues.push({
        code: 'custom',
        path: [index, 'id'],
        message: 'Must not repeat the customer of an earlier item',
        input: id,
      })
    }
    seen.add(id)
  })
}

export const customerBatchGetRequestSchema = z.strictObject({
  ids: customerIds,
}) satisfies z.ZodType<ApiCustomerBatchGetRequest>

export const customerBulkCreateRequestSchema = z.strictObject({
  items: z.array(customerCreateRequestSchema).min(1).max(AT_MOST),
}) satisfies z.ZodType<ApiCustomerBulkCreateRequest>

export const customerBulkUpdateRequestSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: customerIdSchema,
        updates: customerUpdateRequestSchema,
      }),
    )
    .min(1)
    .max(AT_MOST)
    .check(noRepeatedCustomers),
}) satisfies z.ZodType<ApiCustomerBulkUpdateRequest>

export const customerBulkDeleteRequestSchema = z.strictObject({
  ids: customerIds,
}) satisfies z.ZodType<ApiCustomerBulkDeleteRequest>

/** The requests that were checked: the customers they name are IDs of customers. */
export type CustomerBatchGetRequest = z.infer<
  typeof customerBatchGetRequestSchema
>
export type CustomerBulkUpdateRequest = z.infer<
  typeof customerBulkUpdateRequestSchema
>
export type CustomerBulkDeleteRequest = z.infer<
  typeof customerBulkDeleteRequestSchema
>
