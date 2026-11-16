import type { paymentMethods } from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import {
  type DeepRequired,
  type Omit,
  Result,
} from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { type DomainError, parseWith, uuidSchema } from '../shared'

// ID: a UUID that has been checked.
export const paymentMethodIdSchema = uuidSchema.brand<'PaymentMethodId'>()
export type PaymentMethodId = z.infer<typeof paymentMethodIdSchema>

const paymentMethodIdParameterSchema = z.object({ id: paymentMethodIdSchema })

export const parsePaymentMethodId = (
  id: unknown,
): Result<PaymentMethodId, DomainError> =>
  Result.map(
    parseWith(
      paymentMethodIdParameterSchema,
      { id },
      'Invalid payment method ID',
    ),
    (parameters) => parameters.id,
  )

// API types, generated from TypeSpec
export type ApiPaymentMethodResponse =
  components['schemas']['Models.PaymentMethodResponse']
export type ApiPaymentMethodCreateRequest =
  components['schemas']['Models.PaymentMethodCreateRequest']
export type ApiPaymentMethodUpdateRequest =
  components['schemas']['Models.PaymentMethodUpdateRequest']
export type ApiPaymentMethodSearchRequest = NonNullable<
  operations['PaymentMethodCrud_list']['parameters']['query']
>

// Database types, inferred from the Drizzle schema
export type DbPaymentMethod = DeepRequired<typeof paymentMethods.$inferSelect>

/**
 * Columns of `payment_methods` that a request never writes: the database
 * assigns `id` and the timestamps, and the salon comes from the path. The
 * settings of a payment processor (`processorConfig`) may hold credentials
 * and have no defined structure; nothing reads or writes them.
 */
type PaymentMethodManagedColumn =
  | 'id'
  | 'salonId'
  | 'processorConfig'
  | 'createdAt'
  | 'updatedAt'

export type DbNewPaymentMethod = DeepRequired<
  Omit<typeof paymentMethods.$inferInsert, PaymentMethodManagedColumn>
>

/**
 * What a change can write. The method is not among it: the payments that
 * were taken with a payment method are reported by its method, which must
 * not change under them.
 */
export type DbPaymentMethodChanges = Partial<Omit<DbNewPaymentMethod, 'method'>>
