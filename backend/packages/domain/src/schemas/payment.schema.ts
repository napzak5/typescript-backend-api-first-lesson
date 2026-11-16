import { z } from 'zod'
import type {
  ApiPaymentRefundRequest,
  ApiSaleProcessRequest,
} from '../models/payment'
import { paymentMethodIdSchema } from '../models/payment-method'
import { MAX_INTEGER, nonBlankText } from './rules'

/**
 * Validation of the requests that record and refund a payment. The shapes
 * are checked against the generated API types, the limits are those of
 * the database columns, and the remaining rules are business rules.
 *
 * What a request is held to by the sale and by the payment method it meets
 * (what is left to pay, the limits of the payment method, whether it takes
 * cards) is looked at where the payment is written.
 */

/** An amount of money that is received or given back: never nothing. */
const amountOfMoney = z.number().int().min(1).max(MAX_INTEGER)

export const saleProcessRequestSchema = z.strictObject({
  paymentMethodId: paymentMethodIdSchema,
  amount: amountOfMoney,
  cardLastFour: z
    .string()
    .regex(/^[0-9]{4}$/, 'Must be four digits')
    .nullable(),
  cardBrand: nonBlankText.max(50).nullable(),
}) satisfies z.ZodType<ApiSaleProcessRequest>

/** A request to record a payment that passed the rules of its own. */
export type SaleProcessRequest = z.infer<typeof saleProcessRequestSchema>

export const paymentRefundRequestSchema = z.strictObject({
  refundAmount: amountOfMoney,
  refundReason: nonBlankText.nullable(),
}) satisfies z.ZodType<ApiPaymentRefundRequest>

/** A request to refund a payment that passed the rules of its own. */
export type PaymentRefundRequest = z.infer<typeof paymentRefundRequestSchema>
