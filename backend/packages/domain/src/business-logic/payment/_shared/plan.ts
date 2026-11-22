import type {
  PaymentWrite,
  RefundWrite,
  RequestedPayment,
  RequestedRefund,
} from '../../../models/payment'
import type { DbPaymentMethod } from '../../../models/payment-method'
import type { DbPaymentTransaction, DbSale } from '../../../models/sale'
import type { ValidationIssue } from '../../../shared'
import { notFound } from '../../booking/_shared/plan'

/**
 * From the payments of a sale to what the sale is told of them, and from a
 * request to the payment or the refund it writes.
 *
 * No payment processor is connected: a payment is the record of money the
 * till took, so it is written as completed, and a payment that did not go
 * through is not written at all. What a sale has received and given back
 * is counted from its payments every time; the payment status of the sale
 * is that count, written next to them.
 */

/** What a payment says of the money of its sale. */
export type MoneyOfPayment = Pick<
  DbPaymentTransaction,
  'status' | 'amount' | 'refundAmount'
>

/**
 * The statuses of a payment whose money the salon received, whatever it
 * gave back of it since.
 */
const RECEIVED: readonly DbPaymentTransaction['status'][] = [
  'completed',
  'partial_refund',
  'refunded',
]

/** What a sale received with its payments, and what it gave back of that. */
export const moneyOf = (
  payments: readonly MoneyOfPayment[],
): { received: number; returned: number } => {
  const received = payments.filter(({ status }) => RECEIVED.includes(status))

  return {
    received: received.reduce((sum, { amount }) => sum + amount, 0),
    returned: received.reduce(
      (sum, { refundAmount }) => sum + (refundAmount ?? 0),
      0,
    ),
  }
}

/**
 * The payment status of a sale that charges `totalAmount` and has these
 * payments:
 * - `pending`: nothing was received
 * - `processing`: a part of the total was received
 * - `completed`: the total was received
 * - `partial_refund`: a part of what was received was given back
 * - `refunded`: all that was received was given back
 */
export const paymentStatusOf = (
  totalAmount: number,
  payments: readonly MoneyOfPayment[],
): DbSale['paymentStatus'] => {
  const { received, returned } = moneyOf(payments)
  if (returned > 0) {
    return returned === received ? 'refunded' : 'partial_refund'
  }
  if (received === 0) {
    return 'pending'
  }

  return received < totalAmount ? 'processing' : 'completed'
}

/**
 * Why a sale takes no payment, whatever the request names:
 * - `void`: a void sale is a record of what was taken back
 * - `refundMade`: money was given back; a sale that was paid wrongly and
 *   refunded is voided and entered again
 * - `nothingLeft`: the total was received
 */
export type PaymentRefusal =
  | { type: 'void' }
  | { type: 'refundMade' }
  | { type: 'nothingLeft' }

export const refusalOfPayment = (
  sale: Pick<DbSale, 'isVoid' | 'totalAmount'>,
  payments: readonly MoneyOfPayment[],
): PaymentRefusal | null => {
  if (sale.isVoid) {
    return { type: 'void' }
  }
  const { received, returned } = moneyOf(payments)
  if (returned > 0) {
    return { type: 'refundMade' }
  }

  return received >= sale.totalAmount ? { type: 'nothingLeft' } : null
}

/** What the record of a payment takes from the payment method it names. */
export type PaymentMethodOfPayment = Pick<
  DbPaymentMethod,
  'method' | 'isActive' | 'minimumAmount' | 'maximumAmount'
>

/** What a payment gets from the outside. */
export type PaymentOrigin = { transactionNumber: string }

/**
 * A payment to record, or why the request is not one:
 * - `planned`: what is written
 * - `invalid`: the request does not go with the payment method or with
 *   what is left to pay
 */
export type PaymentPlan =
  | { type: 'planned'; write: PaymentWrite }
  | { type: 'invalid'; issues: ValidationIssue[] }

/** The methods of a payment that is made with a card. */
const CARDS: readonly DbPaymentMethod['method'][] = [
  'credit_card',
  'debit_card',
]

/** What a request says of a card. */
const OF_A_CARD: readonly ('cardLastFour' | 'cardBrand')[] = [
  'cardLastFour',
  'cardBrand',
]

export const NOT_A_CARD =
  'Must be null unless the payment method is a credit card or a debit card'

/**
 * What a request breaks of the payment method it names: only a card has
 * the digits and the brand of one, and a payment method takes amounts
 * within its limits.
 */
const issuesOfMethod = (
  paymentMethod: PaymentMethodOfPayment,
  request: RequestedPayment,
): ValidationIssue[] => [
  ...(CARDS.includes(paymentMethod.method)
    ? []
    : OF_A_CARD.flatMap((field) =>
        request[field] === null
          ? []
          : [{ field, rule: 'custom', message: NOT_A_CARD }],
      )),
  ...(paymentMethod.minimumAmount !== null &&
  request.amount < paymentMethod.minimumAmount
    ? [
        {
          field: 'amount',
          rule: 'too_small',
          message: `Must not be less than the minimumAmount of the payment method (${paymentMethod.minimumAmount})`,
        },
      ]
    : []),
  ...(paymentMethod.maximumAmount !== null &&
  request.amount > paymentMethod.maximumAmount
    ? [
        {
          field: 'amount',
          rule: 'too_big',
          message: `Must not be more than the maximumAmount of the payment method (${paymentMethod.maximumAmount})`,
        },
      ]
    : []),
]

/**
 * Plans the payment of a sale that takes one (`refusalOfPayment`).
 * `paymentMethod` is the payment method the request names, when it is one
 * of the salon of the sale; `payments` are the payments the sale has.
 *
 * A payment method that is not in use is none to pay with, and nothing
 * else is asked of it then. Whether a payment method is taken online or at
 * the salon is not asked: a request does not say where the money was
 * taken.
 */
export const planPayment = (
  sale: Pick<DbSale, 'id' | 'totalAmount'>,
  payments: readonly MoneyOfPayment[],
  paymentMethod: PaymentMethodOfPayment | null,
  request: RequestedPayment,
  origin: PaymentOrigin,
): PaymentPlan => {
  const left = sale.totalAmount - moneyOf(payments).received
  const issues = [
    ...(paymentMethod?.isActive === true
      ? issuesOfMethod(paymentMethod, request)
      : [
          notFound(
            'paymentMethodId',
            'a payment method of the salon of the sale that is active',
          ),
        ]),
    ...(request.amount > left
      ? [
          {
            field: 'amount',
            rule: 'too_big',
            message: `Must not be more than what is left to pay (${left})`,
          },
        ]
      : []),
  ]
  if (issues.length > 0) {
    return { type: 'invalid', issues }
  }

  const payment: MoneyOfPayment = {
    status: 'completed',
    amount: request.amount,
    refundAmount: null,
  }

  return {
    type: 'planned',
    write: {
      payment: {
        saleId: sale.id,
        paymentMethodId: request.paymentMethodId,
        transactionNumber: origin.transactionNumber,
        amount: payment.amount,
        status: payment.status,
        cardLastFour: request.cardLastFour,
        cardBrand: request.cardBrand,
      },
      paymentStatus: paymentStatusOf(sale.totalAmount, [...payments, payment]),
    },
  }
}

/**
 * A refund to write, or why the request is not one:
 * - `planned`: what is written
 * - `notCompleted`: only a payment that is completed is refunded, so a
 *   payment is refunded once
 * - `invalid`: more is asked back than the payment received
 */
export type RefundPlan =
  | { type: 'planned'; write: RefundWrite }
  | { type: 'notCompleted' }
  | { type: 'invalid'; issues: ValidationIssue[] }

/**
 * Plans the refund of `payment`. `others` are the other payments of its
 * sale: the payment status of the sale follows from all of them.
 */
export const planRefund = (
  sale: Pick<DbSale, 'totalAmount'>,
  payment: MoneyOfPayment,
  others: readonly MoneyOfPayment[],
  request: RequestedRefund,
): RefundPlan => {
  if (payment.status !== 'completed') {
    return { type: 'notCompleted' }
  }
  if (request.refundAmount > payment.amount) {
    return {
      type: 'invalid',
      issues: [
        {
          field: 'refundAmount',
          rule: 'too_big',
          message: `Must not be more than the amount of the payment (${payment.amount})`,
        },
      ],
    }
  }

  const refunded: MoneyOfPayment = {
    status:
      request.refundAmount === payment.amount ? 'refunded' : 'partial_refund',
    amount: payment.amount,
    refundAmount: request.refundAmount,
  }

  return {
    type: 'planned',
    write: {
      payment: {
        status: refunded.status,
        refundAmount: refunded.refundAmount,
        refundReason: request.refundReason,
      },
      paymentStatus: paymentStatusOf(sale.totalAmount, [...others, refunded]),
    },
  }
}
