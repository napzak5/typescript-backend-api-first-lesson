import type {
  ModelsPaymentMethodResponse,
  ModelsPaymentMethodType,
  ModelsPaymentResponse,
  ModelsPaymentStatusType,
  ModelsSaleResponse,
} from '@beauty-salon-frontend/api-client'
import { amountOf, momentNameAt } from '@beauty-salon-frontend/salon-screens'
import type { BadgeTone } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminSaleMessages } from '@beauty-salon-shared/i18n/messages/admin'

/*
 * A sale and its payments in the words of the salon, and what follows from
 * the payments: what was received, what is left to pay, and whether a
 * payment or a receipt can be had.
 */

const { payments, words } = adminSaleMessages

const PAYMENT_STATUS_NAMES: Record<ModelsPaymentStatusType, LocalizedText> =
  adminSaleMessages.statuses

/** The state of the payment of a sale, in the word the salon uses. */
export const paymentStatusNameOf = (
  status: ModelsPaymentStatusType,
): LocalizedText => PAYMENT_STATUS_NAMES[status]

const PAYMENT_STATUS_TONES: Record<ModelsPaymentStatusType, BadgeTone> = {
  pending: 'warning',
  processing: 'info',
  completed: 'success',
  failed: 'danger',
  refunded: 'neutral',
  partial_refund: 'neutral',
}

/** The group the state belongs to: the colour of its badge. */
export const paymentStatusToneOf = (
  status: ModelsPaymentStatusType,
): BadgeTone => PAYMENT_STATUS_TONES[status]

const PAYMENT_NAMES: Record<ModelsPaymentStatusType, LocalizedText> =
  adminSaleMessages.paymentStatuses

/** The state of one payment of a sale, in the word the salon uses. */
export const paymentNameOf = (status: ModelsPaymentStatusType): LocalizedText =>
  PAYMENT_NAMES[status]

/** The kinds of payment that record the card: its last four digits and its brand. */
export const CARD_METHODS: readonly ModelsPaymentMethodType[] = [
  'credit_card',
  'debit_card',
]

/**
 * The name a payment was received by: that of its method, as the salon
 * wrote it, or that the salon removed it.
 */
export const methodNameOf = (
  paymentMethodId: string,
  methods: readonly Pick<ModelsPaymentMethodResponse, 'id' | 'displayName'>[],
): LocalizedText => {
  const name = methods.find(({ id }) => id === paymentMethodId)?.displayName

  return name === undefined ? words.unlistedMethod : { en: name, ja: name }
}

/**
 * The card a payment was made with: its brand and its last four digits, as
 * far as they were recorded (「VISA 下 4 桁 4242」, "VISA ending in 4242");
 * null when neither was.
 */
export const cardNameOf = ({
  cardBrand,
  cardLastFour,
}: Pick<
  ModelsPaymentResponse,
  'cardBrand' | 'cardLastFour'
>): LocalizedText | null => payments.cardOf(cardBrand, cardLastFour)

/**
 * When a payment was received; for one that was not (it is on its way,
 * or failed), when it was recorded.
 */
export const receivedAtOf = ({
  processedAt,
  createdAt,
}: Pick<ModelsPaymentResponse, 'processedAt' | 'createdAt'>): string =>
  processedAt ?? createdAt

/**
 * What was given back of a payment, and when, as far as it was recorded
 * (「￥500、2026年11月20日（金） 11:30」); null when nothing was. Why is
 * said apart: it is a sentence, and a cell of a table keeps to one line.
 */
export const refundNameOf = (
  {
    refundAmount,
    refundedAt,
  }: Pick<ModelsPaymentResponse, 'refundAmount' | 'refundedAt'>,
  timezone: string,
  currency: string,
): LocalizedText | null =>
  refundAmount === null
    ? null
    : payments.table.refunded(
        amountOf(refundAmount, currency),
        refundedAt === null ? null : momentNameAt(refundedAt, timezone),
      )

/** The states of a payment whose amount was received: a refund does not take it back. */
const RECEIVED: readonly ModelsPaymentStatusType[] = [
  'completed',
  'partial_refund',
  'refunded',
]

const sumOf = (amounts: readonly number[]): number =>
  amounts.reduce((sum, amount) => sum + amount, 0)

/** What was received for a sale: refunds are not taken off. */
export const receivedOf = ({
  payments,
}: Pick<ModelsSaleResponse, 'payments'>) =>
  sumOf(
    payments
      .filter(({ status }) => RECEIVED.includes(status))
      .map(({ amount }) => amount),
  )

/** What was given back of the payments of a sale. */
export const refundedOf = ({
  payments,
}: Pick<ModelsSaleResponse, 'payments'>) =>
  sumOf(payments.map(({ refundAmount }) => refundAmount ?? 0))

/**
 * What is left to pay of a sale, as the API works it out: the total less
 * what was received. A refund does not make it more, and the API takes no
 * payment of more than is left.
 */
export const owedOf = (
  sale: Pick<ModelsSaleResponse, 'payments' | 'totalAmount'>,
): number => sale.totalAmount - receivedOf(sale)

const hasRefund = ({ payments }: Pick<ModelsSaleResponse, 'payments'>) =>
  payments.some(
    ({ refundAmount, status }) =>
      (refundAmount ?? 0) > 0 ||
      status === 'refunded' ||
      status === 'partial_refund',
  )

type Payable = Pick<ModelsSaleResponse, 'isVoid' | 'payments' | 'totalAmount'>

/**
 * Why a sale takes no payment, in a sentence; `undefined` when it takes
 * one. These are the reasons the API refuses one for, in its order.
 */
export const whyNoPayment = (sale: Payable): LocalizedText | undefined => {
  if (sale.isVoid) {
    return payments.why.voided
  }
  if (hasRefund(sale)) {
    return payments.why.refunded
  }
  if (owedOf(sale) === 0) {
    return sale.totalAmount === 0
      ? payments.why.nothingToPay
      : payments.why.paid
  }

  return undefined
}

/**
 * Why a sale has no receipt, in a sentence; `undefined` when it has one:
 * one that is not void, whose total was received.
 */
export const whyNoReceipt = (sale: Payable): LocalizedText | undefined => {
  if (sale.isVoid) {
    return adminSaleMessages.noReceipt.voided
  }
  if (receivedOf(sale) < sale.totalAmount) {
    return adminSaleMessages.noReceipt.unpaid
  }

  return undefined
}
