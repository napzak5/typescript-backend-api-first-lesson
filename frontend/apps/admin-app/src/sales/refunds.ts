import type {
  ModelsPaymentRefundRequest,
  ModelsPaymentResponse,
  ModelsSaleResponse,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import { type Read, textOf } from '../bookings/booking-actions'
import {
  type FormSays,
  nullIfBlank,
  TOO_MANY_REQUESTS,
  yenOf,
} from '../bookings/booking-entry'
import { amountOf } from '../bookings/booking-format'
import type { RefusedValue } from '../reading'
import { whyNoVoid } from './sale-changes'

/*
 * Giving a payment back: which payments are, what the form sends, and what
 * is said about the answer. The system is joined to no payment processor:
 * a refund records money that was given back at the counter.
 */

/** Why a payment is not given back, in a sentence; `undefined` when it is. */
export const whyNoRefund = ({
  status,
}: Pick<ModelsPaymentResponse, 'status'>): string | undefined =>
  match(status)
    .returnType<string | undefined>()
    .with('completed', () => undefined)
    .with('refunded', () => 'この支払いは、全額を返金しました。')
    .with(
      'partial_refund',
      () =>
        'この支払いは、一部を返金しました。1 件の支払いの返金は 1 回で、残りは返金できません。',
    )
    .with(
      P.union('pending', 'processing', 'failed'),
      () => 'この支払いは、受け取っていないため、返金できません。',
    )
    .exhaustive()

const AMOUNT_ERROR = '返金する金額は、1 以上の円の整数で入力してください。'

const REASON_ERROR = '返金の理由を入力してください。'

/** What is wrong with the amount of a refund: none, or more than the payment was. */
const amountErrorOf = (
  amount: number | null | undefined,
  paid: number,
  currency: string,
): string | undefined => {
  if (amount === null || amount === undefined || amount === 0) {
    return AMOUNT_ERROR
  }

  return amount > paid
    ? `返金する金額は、支払いの金額（${amountOf(paid, currency)}）以下にしてください。`
    : undefined
}

/**
 * A refund from its form: at least 1 yen, at most what the payment was, and
 * why it was given back, which the record keeps.
 */
export const readRefund = (
  values: FormData,
  { amount }: Pick<ModelsPaymentResponse, 'amount'>,
  currency: string,
): Read<ModelsPaymentRefundRequest> => {
  const refundAmount = yenOf(textOf(values, 'refundAmount'))
  const refundReason = nullIfBlank(textOf(values, 'refundReason'))
  const amountError = amountErrorOf(refundAmount, amount, currency)
  const errors = {
    ...(amountError === undefined ? {} : { refundAmount: amountError }),
    ...(refundReason === null ? { refundReason: REASON_ERROR } : {}),
  }
  if (
    refundAmount === null ||
    refundAmount === undefined ||
    Object.keys(errors).length > 0
  ) {
    return { type: 'invalid', errors }
  }

  return { type: 'valid', request: { refundAmount, refundReason } }
}

/**
 * Whether a sale can be voided once a payment of it is given back so: every
 * payment it received was then given back whole. Paying again starts so.
 */
export const voidableAfter = (
  sale: Pick<ModelsSaleResponse, 'isVoid' | 'payments'>,
  paymentId: string,
  { refundAmount }: Pick<ModelsPaymentRefundRequest, 'refundAmount'>,
): boolean =>
  whyNoVoid({
    isVoid: sale.isVoid,
    payments: sale.payments.map((payment) =>
      payment.id === paymentId
        ? {
            ...payment,
            status:
              refundAmount === payment.amount ? 'refunded' : 'partial_refund',
          }
        : payment,
    ),
  }) === undefined

/** What came of an attempt to give a payment back, after the API was asked why it refused. */
export type RefundAttempt =
  | { type: 'refunded' }
  | { type: 'invalid'; values: RefusedValue[] }
  /** The sale as it is now: its payment was given back meanwhile */
  | { type: 'refused'; sale: ModelsSaleResponse }
  | { type: 'notFound' }
  | { type: 'forbidden' }
  | { type: 'tooManyRequests' }
  | { type: 'failed' }

/** What the screen does after an attempt. */
export type RefundSays =
  | { type: 'done' }
  | { type: 'again'; message: string | undefined; errors: FormSays['errors'] }
  /** The sale changed: it is shown as it is now, with why its payment is not given back */
  | { type: 'refused'; sale: ModelsSaleResponse }
  /** The payment, or its sale, is gone: the screen says that there is none */
  | { type: 'gone' }

const REFUND_AGAIN =
  '返金を記録できませんでした。通信の状態を確かめて、もう一度お試しください。'

/** What is said at a control of a value the API refused. */
const messageAt = ({ field, rule }: RefusedValue): string =>
  match([field, rule])
    .with(
      ['refundAmount', 'too_big'],
      () => '返金する金額が、支払いの金額を超えています。',
    )
    .with(['refundAmount', P._], () => AMOUNT_ERROR)
    .otherwise(() => REASON_ERROR)

const CONTROLS: readonly string[] = ['refundAmount', 'refundReason']

/** What the screen says and does after an attempt to give a payment back. */
export const afterRefund = (outcome: RefundAttempt): RefundSays =>
  match(outcome)
    .returnType<RefundSays>()
    .with({ type: 'refunded' }, () => ({ type: 'done' }))
    .with({ type: 'invalid' }, ({ values }) => {
      const atControls = values.filter(({ field }) => CONTROLS.includes(field))

      return atControls.length === 0
        ? { type: 'again', message: REFUND_AGAIN, errors: {} }
        : {
            type: 'again',
            message: undefined,
            errors: Object.fromEntries(
              atControls
                .toReversed()
                .map((value) => [value.field, messageAt(value)]),
            ),
          }
    })
    .with({ type: 'refused' }, ({ sale }) => ({ type: 'refused', sale }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'forbidden' }, () => ({
      type: 'again',
      message:
        'このアカウントでは、返金を記録できません。返金は、オーナーとマネージャーができます。',
      errors: {},
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      ...TOO_MANY_REQUESTS,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: REFUND_AGAIN,
      errors: {},
    }))
    .exhaustive()
