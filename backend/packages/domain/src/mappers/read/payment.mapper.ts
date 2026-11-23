import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiPaymentResponse,
  DbPaymentTransaction,
} from '../../models/sale'
import { type DomainError, parseStored } from '../../shared'
import { timestampSchema } from './columns'

/**
 * A row of `payment_transactions` → API response. Property names are the
 * column names; what changes is the representation of the timestamps, from
 * PostgreSQL's text format to ISO 8601.
 *
 * Every property is named: a payment has columns for what a payment
 * processor answered (`processorResponse`, `metadata`), which no response
 * shows, and a column added to the table is not shown by itself.
 */

const convertedColumnsSchema = z.object({
  processedAt: timestampSchema.nullable(),
  failedAt: timestampSchema.nullable(),
  refundedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}) satisfies z.ZodType<
  Pick<
    ApiPaymentResponse,
    'processedAt' | 'failedAt' | 'refundedAt' | 'createdAt' | 'updatedAt'
  >
>

/**
 * The payment as a response shows it. A row that does not match is
 * reported as the validation found it: whoever maps says which stored
 * record it is of, the payment or the sale it is read with.
 */
export const toApiPayment = (
  payment: DbPaymentTransaction,
  description: string,
): Result<ApiPaymentResponse, DomainError> =>
  Result.map(
    parseStored(convertedColumnsSchema, payment, description),
    (converted) => ({
      id: payment.id,
      saleId: payment.saleId,
      paymentMethodId: payment.paymentMethodId,
      transactionNumber: payment.transactionNumber,
      amount: payment.amount,
      status: payment.status,
      processorTransactionId: payment.processorTransactionId,
      cardLastFour: payment.cardLastFour,
      cardBrand: payment.cardBrand,
      errorCode: payment.errorCode,
      errorMessage: payment.errorMessage,
      processedAt: converted.processedAt,
      failedAt: converted.failedAt,
      refundedAt: converted.refundedAt,
      refundAmount: payment.refundAmount,
      refundReason: payment.refundReason,
      createdAt: converted.createdAt,
      updatedAt: converted.updatedAt,
    }),
  )

export const PaymentReadMapper = {
  toApiPayment(
    payment: DbPaymentTransaction,
  ): Result<ApiPaymentResponse, DomainError> {
    return toApiPayment(
      payment,
      `Stored payment ${payment.id} does not match the API model`,
    )
  },
}
