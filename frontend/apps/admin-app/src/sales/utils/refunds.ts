import {
  type RefusedValue,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsPaymentRefundRequest,
  ModelsPaymentResponse,
  ModelsSaleResponse,
} from '@beauty-salon-frontend/api-client'
import { amountOf } from '@beauty-salon-frontend/salon-screens'
import {
  aboutTheAttempt,
  type FormErrors,
  type FormRead,
  type FormSays,
  NO_ERRORS,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminSaleMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match, P } from 'ts-pattern'
import { yenOf } from '../../bookings/utils/booking-entry'
import { whyNoVoid } from './sale-changes'

/*
 * Giving a payment back: which payments are, what the form sends, and what
 * is said about the answer. The system is joined to no payment processor:
 * a refund records money that was given back at the counter.
 */

const { refund: words } = adminSaleMessages.payments

/** Why a payment is not given back, in a sentence; `undefined` when it is. */
export const whyNoRefund = ({
  status,
}: Pick<ModelsPaymentResponse, 'status'>): LocalizedText | undefined =>
  match(status)
    .returnType<LocalizedText | undefined>()
    .with('completed', () => undefined)
    .with('refunded', () => words.why.refunded)
    .with('partial_refund', () => words.why.partlyRefunded)
    .with(
      P.union('pending', 'processing', 'failed'),
      () => words.why.notReceived,
    )
    .exhaustive()

/** What is wrong with the amount of a refund: none, or more than the payment was. */
const amountErrorOf = (
  amount: number | null | undefined,
  paid: number,
  currency: string,
): LocalizedText | undefined => {
  if (amount === null || amount === undefined || amount === 0) {
    return words.errors.amount
  }

  return amount > paid
    ? words.errors.moreThanPaid(amountOf(paid, currency))
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
): FormRead<ModelsPaymentRefundRequest, FormErrors<LocalizedText>> => {
  const refundAmount = yenOf(textOf(values, 'refundAmount'))
  const refundReason = textOrNull(textOf(values, 'refundReason'))
  const amountError = amountErrorOf(refundAmount, amount, currency)
  const errors = {
    ...(amountError === undefined ? {} : { refundAmount: amountError }),
    ...(refundReason === null ? { refundReason: words.errors.reason } : {}),
  }
  if (
    refundAmount === null ||
    refundAmount === undefined ||
    Object.keys(errors).length > 0
  ) {
    return { type: 'invalid', errors }
  }

  return { type: 'valid', value: { refundAmount, refundReason } }
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
  | ({ type: 'again' } & FormSays<LocalizedText>)
  /** The sale changed: it is shown as it is now, with why its payment is not given back */
  | { type: 'refused'; sale: ModelsSaleResponse }
  /** The payment, or its sale, is gone: the screen says that there is none */
  | { type: 'gone' }

const REFUND_AGAIN = words.failed

/** What is said at a control of a value the API refused. */
const messageAt = ({ field, rule }: RefusedValue): LocalizedText =>
  match([field, rule])
    .with(['refundAmount', 'too_big'], () => words.errors.tooBig)
    .with(['refundAmount', P._], () => words.errors.amount)
    .otherwise(() => words.errors.reason)

const CONTROLS: readonly string[] = ['refundAmount', 'refundReason']

/** What the screen says and does after an attempt to give a payment back. */
export const afterRefund = (outcome: RefundAttempt): RefundSays =>
  match(outcome)
    .returnType<RefundSays>()
    .with({ type: 'refunded' }, () => ({ type: 'done' }))
    .with({ type: 'invalid' }, ({ values }) => {
      const atControls = values.filter(({ field }) => CONTROLS.includes(field))

      return atControls.length === 0
        ? { type: 'again', message: REFUND_AGAIN, errors: NO_ERRORS }
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
      ...aboutTheAttempt(words.forbidden),
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      ...aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      ...aboutTheAttempt(REFUND_AGAIN),
    }))
    .exhaustive()
