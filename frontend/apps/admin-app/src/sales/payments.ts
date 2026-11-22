import {
  REFUSED_VALUE_MESSAGE,
  type RefusedValue,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsPaymentMethodResponse,
  ModelsSaleProcessRequest,
  ModelsSaleResponse,
} from '@beauty-salon-frontend/api-client'
import { tooLongError, tooLongOf } from '@beauty-salon-frontend/fields'
import { amountOf } from '@beauty-salon-frontend/salon-screens'
import {
  errorAt,
  type FormRead,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import { match, P } from 'ts-pattern'
import { yenOf } from '../bookings/booking-entry'
import { CARD_METHODS, whyNoPayment } from './sale-format'

/*
 * Recording a payment of a sale: the methods offered, what the form sends,
 * and what is said about the answer.
 */

/** The methods a payment is received by now: those the salon uses, in its order. */
export const methodsInUse = (
  methods: readonly ModelsPaymentMethodResponse[],
): ModelsPaymentMethodResponse[] =>
  methods
    .filter(({ isActive }) => isActive)
    .toSorted((one, other) =>
      one.sortOrder === other.sortOrder
        ? one.id.localeCompare(other.id)
        : one.sortOrder - other.sortOrder,
    )

/** Whether a method records the card a payment was made with. */
export const takesCard = ({
  method,
}: Pick<ModelsPaymentMethodResponse, 'method'>): boolean =>
  CARD_METHODS.includes(method)

/** What a method takes at once, in a sentence: its smallest and largest amount. */
export const limitsOf = (
  {
    minimumAmount,
    maximumAmount,
  }: Pick<ModelsPaymentMethodResponse, 'minimumAmount' | 'maximumAmount'>,
  currency: string,
): string | undefined =>
  match([minimumAmount, maximumAmount])
    .returnType<string | undefined>()
    .with([null, null], () => undefined)
    .with(
      [P.number, null],
      ([least]) => `1 回 ${amountOf(least, currency)}から受け付けます。`,
    )
    .with(
      [null, P.number],
      ([, most]) => `1 回 ${amountOf(most, currency)}まで受け付けます。`,
    )
    .with(
      [P.number, P.number],
      ([least, most]) =>
        `1 回 ${amountOf(least, currency)}から${amountOf(most, currency)}まで受け付けます。`,
    )
    .exhaustive()

/** A method as it is offered: its name, and what it takes at once. */
export const methodLabelOf = (
  method: Pick<
    ModelsPaymentMethodResponse,
    'displayName' | 'minimumAmount' | 'maximumAmount'
  >,
  currency: string,
): string =>
  match([method.minimumAmount, method.maximumAmount])
    .returnType<string>()
    .with([null, null], () => method.displayName)
    .with(
      [P.number, null],
      ([least]) => `${method.displayName}（${amountOf(least, currency)}から）`,
    )
    .with(
      [null, P.number],
      ([, most]) => `${method.displayName}（${amountOf(most, currency)}まで）`,
    )
    .with(
      [P.number, P.number],
      ([least, most]) =>
        `${method.displayName}（${amountOf(least, currency)}〜${amountOf(most, currency)}）`,
    )
    .exhaustive()

const METHOD_ERROR = '支払い方法を選んでください。'

const AMOUNT_ERROR = '金額は、1 以上の円の整数で入力してください。'

const LAST_FOUR_ERROR = 'カードの下 4 桁は、4 桁の数字で入力してください。'

/** The longest brand of a card the API takes */
const LONGEST_BRAND = 50

const BRAND_ERROR = tooLongOf('カードのブランド', LONGEST_BRAND)

/**
 * What is wrong with an amount: none, more than is left to pay, or what
 * the method does not take at once.
 */
const amountErrorOf = (
  amount: number | null | undefined,
  method: ModelsPaymentMethodResponse | undefined,
  owed: number,
  currency: string,
): string | undefined => {
  if (amount === null || amount === undefined || amount === 0) {
    return AMOUNT_ERROR
  }
  if (amount > owed) {
    return `金額は、未払い残額（${amountOf(owed, currency)}）以下にしてください。`
  }
  if (method === undefined) {
    return undefined
  }
  const least = method.minimumAmount ?? 0
  const most = method.maximumAmount ?? Number.POSITIVE_INFINITY

  return amount < least || amount > most
    ? `${method.displayName}は、${limitsOf(method, currency) ?? ''}`
    : undefined
}

/**
 * A payment from its form. The amount is checked against what is left to
 * pay and against what the method takes at once, as the API checks it;
 * the card is recorded only for a payment by card, and may be left out.
 */
export const readPayment = (
  values: FormData,
  methods: readonly ModelsPaymentMethodResponse[],
  owed: number,
  currency: string,
): FormRead<ModelsSaleProcessRequest> => {
  const method = methods.find(
    ({ id }) => id === textOf(values, 'paymentMethodId'),
  )
  const amount = yenOf(textOf(values, 'amount'))
  const card = method !== undefined && takesCard(method)
  const lastFour = card
    ? textOrNull(textOf(values, 'cardLastFour').normalize('NFKC'))
    : null
  const brand = card ? textOrNull(textOf(values, 'cardBrand')) : null
  const amountError = amountErrorOf(amount, method, owed, currency)
  const errors = {
    ...(method === undefined ? { paymentMethodId: METHOD_ERROR } : {}),
    ...(amountError === undefined ? {} : { amount: amountError }),
    ...(lastFour === null || /^\d{4}$/.test(lastFour)
      ? {}
      : { cardLastFour: LAST_FOUR_ERROR }),
    ...Object.fromEntries(
      errorAt('cardBrand', tooLongError(brand, LONGEST_BRAND, BRAND_ERROR)),
    ),
  }
  if (
    method === undefined ||
    amount === null ||
    amount === undefined ||
    Object.keys(errors).length > 0
  ) {
    return { type: 'invalid', errors }
  }

  return {
    type: 'valid',
    value: {
      paymentMethodId: method.id,
      amount,
      cardLastFour: lastFour,
      cardBrand: brand,
    },
  }
}

/** What came of an attempt to record a payment, after the API was asked why it refused. */
export type PaymentAttempt =
  | { type: 'recorded' }
  | { type: 'invalid'; values: RefusedValue[] }
  /** The sale as it is now, which takes no payment */
  | { type: 'refused'; sale: ModelsSaleResponse }
  | { type: 'notFound' }
  | { type: 'forbidden' }
  | { type: 'tooManyRequests' }
  | { type: 'failed' }

/** What the screen does after an attempt. */
export type PaymentSays =
  | { type: 'done' }
  | {
      type: 'again'
      message: string | undefined
      errors: Record<string, string>
    }
  /** The sale changed: it is shown as it is now, with why it takes no payment */
  | { type: 'refused'; sale: ModelsSaleResponse; message: string }
  | { type: 'gone' }

const TRY_AGAIN =
  '支払いを記録できませんでした。通信の状態を確かめて、もう一度お試しください。'

/** What is said at a control of a value the API refused. */
const messageAt = ({ field, rule }: RefusedValue): string =>
  match([field, rule])
    .with(
      ['paymentMethodId', P._],
      () => 'この支払い方法は、もう使えません。選び直してください。',
    )
    .with(
      ['amount', 'too_big'],
      () => '未払い残額か、支払い方法が 1 回に受け付ける金額を超えています。',
    )
    .with(
      ['amount', 'too_small'],
      () => '支払い方法が 1 回に受け付ける金額より少ない金額です。',
    )
    .with(['cardLastFour', P._], () => LAST_FOUR_ERROR)
    .with(['cardBrand', P._], () => BRAND_ERROR)
    .otherwise(() => REFUSED_VALUE_MESSAGE)

const CONTROLS: readonly string[] = [
  'paymentMethodId',
  'amount',
  'cardLastFour',
  'cardBrand',
]

/** What the screen says and does after an attempt to record a payment. */
export const afterPayment = (outcome: PaymentAttempt): PaymentSays =>
  match(outcome)
    .returnType<PaymentSays>()
    .with({ type: 'recorded' }, () => ({ type: 'done' }))
    .with({ type: 'invalid' }, ({ values }) => {
      const atControls = values.filter(({ field }) => CONTROLS.includes(field))

      return atControls.length === 0
        ? { type: 'again', message: TRY_AGAIN, errors: {} }
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
    .with({ type: 'refused' }, ({ sale }) => ({
      type: 'refused',
      sale,
      message: whyNoPayment(sale) ?? TRY_AGAIN,
    }))
    .with({ type: P.union('notFound', 'forbidden') }, () => ({ type: 'gone' }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
      errors: {},
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: TRY_AGAIN,
      errors: {},
    }))
    .exhaustive()
