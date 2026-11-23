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
  type FormErrors,
  type FormRead,
  NO_ERRORS,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminSaleMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match, P } from 'ts-pattern'
import { yenOf } from '../../bookings/utils/booking-entry'
import { CARD_METHODS, whyNoPayment } from './sale-format'

/*
 * Recording a payment of a sale: the methods offered, what the form sends,
 * and what is said about the answer.
 */

const { payment: words, errors: wrong, refusals } = adminSaleMessages.payments

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

/** What a method takes at once, as the catalogue says it */
type Limits = Parameters<typeof words.limits>[0]

/**
 * What a method takes at once, in amounts of the currency of the salon:
 * its smallest, its largest, or both; `null` when it takes any amount.
 */
const limitsIn = (
  {
    minimumAmount,
    maximumAmount,
  }: Pick<ModelsPaymentMethodResponse, 'minimumAmount' | 'maximumAmount'>,
  currency: string,
): Limits | null =>
  match([minimumAmount, maximumAmount])
    .returnType<Limits | null>()
    .with([null, null], () => null)
    .with([null, P.number], ([, most]) => ({
      least: null,
      most: amountOf(most, currency),
    }))
    .with([P.number, P.union(P.number, null)], ([least, most]) => ({
      least: amountOf(least, currency),
      most: most === null ? null : amountOf(most, currency),
    }))
    .exhaustive()

/** What a method takes at once, in a sentence; `undefined` when it takes any amount. */
export const limitsOf = (
  method: Pick<ModelsPaymentMethodResponse, 'minimumAmount' | 'maximumAmount'>,
  currency: string,
): LocalizedText | undefined => {
  const limits = limitsIn(method, currency)

  return limits === null ? undefined : words.limits(limits)
}

/** A method as it is offered: its name, and what it takes at once. */
export const methodLabelOf = (
  method: Pick<
    ModelsPaymentMethodResponse,
    'displayName' | 'minimumAmount' | 'maximumAmount'
  >,
  currency: string,
): LocalizedText =>
  words.methodLabel(method.displayName, limitsIn(method, currency))

/** The longest brand of a card the API takes */
const LONGEST_BRAND = 50

const BRAND_ERROR = tooLongOf(words.cardBrand, LONGEST_BRAND)

/**
 * What is wrong with an amount: none, more than is left to pay, or what
 * the method does not take at once.
 */
const amountErrorOf = (
  amount: number | null | undefined,
  method: ModelsPaymentMethodResponse | undefined,
  owed: number,
  currency: string,
): LocalizedText | undefined => {
  if (amount === null || amount === undefined || amount === 0) {
    return wrong.amount
  }
  if (amount > owed) {
    return wrong.moreThanOwed(amountOf(owed, currency))
  }
  const limits = method === undefined ? null : limitsIn(method, currency)
  if (method === undefined || limits === null) {
    return undefined
  }
  const least = method.minimumAmount ?? 0
  const most = method.maximumAmount ?? Number.POSITIVE_INFINITY

  return amount < least || amount > most
    ? wrong.outsideLimits(method.displayName, limits)
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
): FormRead<ModelsSaleProcessRequest, FormErrors<LocalizedText>> => {
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
  const errors: FormErrors<LocalizedText> = {
    ...(method === undefined ? { paymentMethodId: wrong.method } : {}),
    ...(amountError === undefined ? {} : { amount: amountError }),
    ...(lastFour === null || /^\d{4}$/.test(lastFour)
      ? {}
      : { cardLastFour: wrong.lastFour }),
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
      message: LocalizedText | undefined
      errors: FormErrors<LocalizedText>
    }
  /** The sale changed: it is shown as it is now, with why it takes no payment */
  | { type: 'refused'; sale: ModelsSaleResponse; message: LocalizedText }
  | { type: 'gone' }

const TRY_AGAIN = adminSaleMessages.payments.failed

/** What is said at a control of a value the API refused. */
const messageAt = ({ field, rule }: RefusedValue): LocalizedText =>
  match([field, rule])
    .with(['paymentMethodId', P._], () => refusals.method)
    .with(['amount', 'too_big'], () => refusals.tooBig)
    .with(['amount', 'too_small'], () => refusals.tooSmall)
    .with(['cardLastFour', P._], () => wrong.lastFour)
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
        ? { type: 'again', message: TRY_AGAIN, errors: NO_ERRORS }
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
      errors: NO_ERRORS,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: TRY_AGAIN,
      errors: NO_ERRORS,
    }))
    .exhaustive()
