import type {
  ModelsPaymentMethodResponse,
  ModelsPaymentMethodType,
  ModelsPaymentResponse,
  ModelsPaymentStatusType,
  ModelsSaleResponse,
} from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import type { BadgeProps } from '@beauty-salon-frontend/ui'
import { amountOf } from '../bookings/booking-format'

/*
 * A sale and its payments in the words of the salon, and what follows from
 * the payments: what was received, what is left to pay, and whether a
 * payment or a receipt can be had.
 */

const PAYMENT_STATUS_NAMES: Record<ModelsPaymentStatusType, string> = {
  pending: '未払い',
  processing: '一部受け取り',
  completed: '支払い済み',
  failed: '失敗',
  refunded: '返金済み',
  partial_refund: '一部返金',
}

/** The state of the payment of a sale, in the word the salon uses. */
export const paymentStatusNameOf = (status: ModelsPaymentStatusType): string =>
  PAYMENT_STATUS_NAMES[status]

const PAYMENT_STATUS_TONES: Record<
  ModelsPaymentStatusType,
  NonNullable<BadgeProps['tone']>
> = {
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
): NonNullable<BadgeProps['tone']> => PAYMENT_STATUS_TONES[status]

const PAYMENT_NAMES: Record<ModelsPaymentStatusType, string> = {
  pending: '処理待ち',
  processing: '処理中',
  completed: '受け取り',
  failed: '失敗',
  refunded: '返金済み',
  partial_refund: '一部返金',
}

/** The state of one payment of a sale, in the word the salon uses. */
export const paymentNameOf = (status: ModelsPaymentStatusType): string =>
  PAYMENT_NAMES[status]

const METHOD_NAMES: Record<ModelsPaymentMethodType, string> = {
  cash: '現金',
  credit_card: 'クレジットカード',
  debit_card: 'デビットカード',
  e_money: '電子マネー',
  qr_payment: 'QR コード決済',
  bank_transfer: '銀行振込',
  point: 'ポイント',
}

/** A kind of payment, in the word the salon uses. */
export const methodKindNameOf = (method: ModelsPaymentMethodType): string =>
  METHOD_NAMES[method]

/** The kinds of payment that record the card: its last four digits and its brand. */
export const CARD_METHODS: readonly ModelsPaymentMethodType[] = [
  'credit_card',
  'debit_card',
]

/** What is said of a payment method the salon removed. */
const UNLISTED_METHOD = '一覧にない支払い方法'

/** The name a payment was received by: that of its method. */
export const methodNameOf = (
  paymentMethodId: string,
  methods: readonly Pick<ModelsPaymentMethodResponse, 'id' | 'displayName'>[],
): string =>
  methods.find(({ id }) => id === paymentMethodId)?.displayName ??
  UNLISTED_METHOD

/**
 * The card a payment was made with: its brand and its last four digits, as
 * far as they were recorded (「VISA 下 4 桁 4242」); null when neither was.
 */
export const cardNameOf = ({
  cardBrand,
  cardLastFour,
}: Pick<ModelsPaymentResponse, 'cardBrand' | 'cardLastFour'>):
  | string
  | null => {
  const parts = [
    ...(cardBrand === null ? [] : [cardBrand]),
    ...(cardLastFour === null ? [] : [`下 4 桁 ${cardLastFour}`]),
  ]

  return parts.length === 0 ? null : parts.join(' ')
}

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
): string | null =>
  refundAmount === null
    ? null
    : [
        amountOf(refundAmount, currency),
        ...(refundedAt === null ? [] : [momentNameAt(refundedAt, timezone)]),
      ].join('、')

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
export const whyNoPayment = (sale: Payable): string | undefined => {
  if (sale.isVoid) {
    return 'この売上は取り消されているため、支払いを記録できません。'
  }
  if (hasRefund(sale)) {
    return 'この売上には返金があるため、支払いを記録できません。払い直すときは、売上を取り消して、会計を入れ直してください。'
  }
  if (owedOf(sale) === 0) {
    return sale.totalAmount === 0
      ? '合計が 0 円の売上は、受け取る支払いがありません。'
      : 'この売上は、合計を受け取りました。'
  }

  return undefined
}

/**
 * Why a sale has no receipt, in a sentence; `undefined` when it has one:
 * one that is not void, whose total was received.
 */
export const whyNoReceipt = (sale: Payable): string | undefined => {
  if (sale.isVoid) {
    return '取り消された売上の、レシートは出せません。'
  }
  if (receivedOf(sale) < sale.totalAmount) {
    return 'レシートは、合計を受け取ってから出せます。'
  }

  return undefined
}
