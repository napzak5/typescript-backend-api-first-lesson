import { PaymentMethodTypeSchema } from '@beauty-salon-backend/generated'
import { z } from 'zod'
import {
  type AmountLimits,
  limitsAreInOrder,
} from '../business-logic/payment-method/_shared/limits'
import {
  type ApiPaymentMethodCreateRequest,
  type ApiPaymentMethodSearchRequest,
  type ApiPaymentMethodUpdateRequest,
  paymentMethodIdSchema,
} from '../models/payment-method'
import { atLeastOneProperty, MAX_INTEGER, nonBlankText } from './rules'

/**
 * Validation of payment method requests. The shapes are checked against the
 * generated API types, the limits are those of the database columns, and
 * the remaining rules are business rules.
 *
 * A request cannot state the settings of a payment processor
 * (`processorConfig`), and an update cannot state the method: the schemas
 * are strict, so either is refused as a property that is not known.
 */

export const LIMITS_OUT_OF_ORDER = {
  minimumAmount: 'Must not be more than maximumAmount',
  maximumAmount: 'Must not be less than minimumAmount',
}

/** A limit of the amount of one payment; null is no limit. */
const amountLimit = z.number().int().min(1).max(MAX_INTEGER).nullable()

const LIMITS: PropertyKey[] = ['minimumAmount', 'maximumAmount']

/**
 * A request that names both limits names them in order. Of an update that
 * names one of them, only the stored payment method tells: that is looked
 * at where the payment method is written.
 *
 * Limits are compared only when each of them is one: a limit that is
 * refused for what it is has been reported, and says nothing of their
 * order.
 */
const limitsInOrder = (
  context: z.core.ParsePayload<Partial<AmountLimits>>,
): void => {
  const { minimumAmount, maximumAmount } = context.value
  const aLimitIsRefused = context.issues.some(({ path }) =>
    LIMITS.includes(path?.[0] ?? ''),
  )
  if (
    !aLimitIsRefused &&
    minimumAmount !== undefined &&
    maximumAmount !== undefined &&
    !limitsAreInOrder({ minimumAmount, maximumAmount })
  ) {
    context.issues.push({
      code: 'custom',
      path: ['maximumAmount'],
      message: LIMITS_OUT_OF_ORDER.maximumAmount,
      input: maximumAmount,
    })
  }
}

/** What a request states of a payment method besides its method. */
const statedOfPaymentMethod = {
  displayName: nonBlankText.max(100),
  description: nonBlankText.nullable(),
  processorName: nonBlankText.max(100).nullable(),
  fee: z.number().min(0).max(100).multipleOf(0.01).nullable(),
  minimumAmount: amountLimit,
  maximumAmount: amountLimit,
  isOnlineEnabled: z.boolean(),
  isOfflineEnabled: z.boolean(),
  sortOrder: z.number().int().min(0).max(MAX_INTEGER),
  isActive: z.boolean(),
}

export const paymentMethodCreateRequestSchema = z
  .strictObject({ method: PaymentMethodTypeSchema, ...statedOfPaymentMethod })
  .check(limitsInOrder) satisfies z.ZodType<ApiPaymentMethodCreateRequest>

export const paymentMethodUpdateRequestSchema = z
  .strictObject(statedOfPaymentMethod)
  .exactPartial()
  .check(
    limitsInOrder,
    atLeastOneProperty,
  ) satisfies z.ZodType<ApiPaymentMethodUpdateRequest>

export const paymentMethodSearchRequestSchema = z.strictObject({
  limit: z.number().int().min(1).max(100).exactOptional(),
  cursor: paymentMethodIdSchema.exactOptional(),
  method: PaymentMethodTypeSchema.exactOptional(),
  isActive: z.boolean().exactOptional(),
}) satisfies z.ZodType<ApiPaymentMethodSearchRequest>
