import type { components } from '@beauty-salon-backend/generated'
import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { type DomainError, parseWith, uuidSchema } from '../shared'
import type { PaymentMethodId } from './payment-method'
import type { DbPaymentTransaction, DbSale } from './sale'

// ID: a UUID that has been checked.
export const paymentIdSchema = uuidSchema.brand<'PaymentId'>()
export type PaymentId = z.infer<typeof paymentIdSchema>

const paymentIdParameterSchema = z.object({ id: paymentIdSchema })

export const parsePaymentId = (id: unknown): Result<PaymentId, DomainError> =>
  Result.map(
    parseWith(paymentIdParameterSchema, { id }, 'Invalid payment ID'),
    (parameters) => parameters.id,
  )

// API types, generated from TypeSpec. The response of a payment and its row
// are those a sale is read with (`models/sale.ts`).
export type ApiSaleProcessRequest =
  components['schemas']['Models.SaleProcessRequest']
export type ApiPaymentRefundRequest =
  components['schemas']['Models.PaymentRefundRequest']

/**
 * The payment a request asks to record: what the till took, and with which
 * payment method of the salon. Its number, its status and the payment
 * status of its sale are not among it: they are worked out (`planPayment`).
 */
export type RequestedPayment = {
  paymentMethodId: PaymentMethodId
  amount: number
  /** The last four digits of the card; null unless a card was used. */
  cardLastFour: string | null
  cardBrand: string | null
}

/** The refund a request asks for: how much is given back, and why, when it says. */
export type RequestedRefund = {
  refundAmount: number
  refundReason: string | null
}

/**
 * What the record of a payment writes: the payment, and the payment status
 * its sale has with it. The times are not among it; they are the
 * database's when the rows are written. No column of a payment processor
 * is among it either: none is connected, and a payment is the record of
 * what the till took.
 */
export type PaymentWrite = {
  payment: Pick<
    DbPaymentTransaction,
    | 'saleId'
    | 'paymentMethodId'
    | 'transactionNumber'
    | 'amount'
    | 'status'
    | 'cardLastFour'
    | 'cardBrand'
  >
  paymentStatus: DbSale['paymentStatus']
}

/**
 * What a refund writes: the status and the refund of the payment, and the
 * payment status its sale has with it.
 */
export type RefundWrite = {
  payment: Pick<
    DbPaymentTransaction,
    'status' | 'refundAmount' | 'refundReason'
  >
  paymentStatus: DbSale['paymentStatus']
}
