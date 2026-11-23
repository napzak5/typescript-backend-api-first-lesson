import { CustomerMergeConflictResolutionTypeSchema } from '@beauty-salon-backend/generated'
import { asOneString } from '@beauty-salon-shared/i18n'
import { customerMessages } from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import {
  type ApiCustomerMergeRequest,
  customerIdSchema,
} from '../models/customer'

/**
 * A merge names two customers: the one kept and another one merged into
 * it. The same customer named twice is reported at the one to be merged.
 * Whether both are there is decided where they are merged.
 */
const differentCustomers = (
  context: z.core.ParsePayload<{
    primaryCustomerId: string
    secondaryCustomerId: string
  }>,
): void => {
  const { primaryCustomerId, secondaryCustomerId } = context.value
  if (primaryCustomerId === secondaryCustomerId) {
    context.issues.push({
      code: 'custom',
      path: ['secondaryCustomerId'],
      message: asOneString(customerMessages.anotherThanPrimary),
      input: secondaryCustomerId,
    })
  }
}

export const customerMergeRequestSchema = z
  .strictObject({
    primaryCustomerId: customerIdSchema,
    secondaryCustomerId: customerIdSchema,
    conflictResolution: CustomerMergeConflictResolutionTypeSchema,
  })
  .check(differentCustomers) satisfies z.ZodType<ApiCustomerMergeRequest>

export type CustomerMergeRequest = z.infer<typeof customerMergeRequestSchema>
