import {
  CHECK_THE_VALUES_MESSAGE,
  REFUSED_VALUE_MESSAGE,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsPaymentMethodCreateRequest,
  ModelsPaymentMethodResponse,
  ModelsPaymentMethodType,
  ModelsPaymentMethodUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import {
  neededError,
  neededWithin,
  tooLongError,
  tooLongOf,
} from '@beauty-salon-frontend/fields'
import {
  aboutTheAttempt,
  errorAt,
  type FormErrors,
  type FormRead,
  type FormSays,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminPaymentMethodMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import { yenOf } from '../../bookings/utils/booking-entry'
import { numberOf } from '../../treatments/utils/treatment-form'
import type { TreatmentRemovalSays } from '../../treatments/utils/treatment-format'
import type {
  PaymentMethodRemoval,
  PaymentMethodWrite,
} from '../api/payment-methods-api'
import { METHOD_KINDS } from './payment-method-format'

const { form, removal, words } = adminPaymentMethodMessages
const { errors: ERRORS } = form

type Errors = FormErrors<LocalizedText>

/*
 * The form of a payment method: what it sends, and what it says about the
 * answers.
 */

/** The longest name of a method, and of the company that processes its payments */
export const LONGEST_NAME = 100
const LONGEST_FEE = 100

const NAME_ERROR = neededWithin(words.displayName, LONGEST_NAME)
const PROCESSOR_ERROR = tooLongOf(ERRORS.processorName, LONGEST_NAME)

/** The controls of the form, by the names of the request */
const CONTROLS: readonly string[] = [
  'method',
  'displayName',
  'description',
  'processorName',
  'fee',
  'minimumAmount',
  'maximumAmount',
  'isOfflineEnabled',
  'isOnlineEnabled',
  'sortOrder',
  'isActive',
]
/** An amount the API takes at once: a whole number of yen from 1. */
const amountError = (
  amount: number | null | undefined,
  message: LocalizedText,
): LocalizedText | undefined =>
  amount === undefined || amount === 0 ? message : undefined

/**
 * The whole payment method the form holds, or what is wrong with it. The
 * kind is that of the form when it offers one, or else that of the method
 * it was opened with: the kind of a method is not changed.
 */
const readWhole = (
  values: FormData,
  kept: ModelsPaymentMethodType | undefined,
): FormRead<ModelsPaymentMethodCreateRequest, Errors> => {
  const method =
    kept ?? METHOD_KINDS.find((one) => one === textOf(values, 'method'))
  const displayName = textOf(values, 'displayName').trim()
  const processorName = textOrNull(textOf(values, 'processorName'))
  const fee = numberOf(textOf(values, 'fee'), 2)
  const minimumAmount = yenOf(textOf(values, 'minimumAmount'))
  const maximumAmount = yenOf(textOf(values, 'maximumAmount'))
  const sortOrder = numberOf(textOf(values, 'sortOrder'), 0)
  const errors = Object.fromEntries([
    ...errorAt('method', method === undefined ? ERRORS.kind : undefined),
    ...errorAt(
      'displayName',
      neededError(displayName, LONGEST_NAME, NAME_ERROR),
    ),
    ...errorAt(
      'processorName',
      tooLongError(processorName, LONGEST_NAME, PROCESSOR_ERROR),
    ),
    ...errorAt(
      'fee',
      fee === undefined || (fee !== null && fee > LONGEST_FEE)
        ? ERRORS.fee
        : undefined,
    ),
    ...errorAt('minimumAmount', amountError(minimumAmount, ERRORS.minimum)),
    ...errorAt(
      'maximumAmount',
      amountError(maximumAmount, ERRORS.maximum) ??
        (typeof minimumAmount === 'number' &&
        typeof maximumAmount === 'number' &&
        minimumAmount > maximumAmount
          ? ERRORS.range
          : undefined),
    ),
    ...errorAt(
      'sortOrder',
      sortOrder === null || sortOrder === undefined
        ? ERRORS.sortOrder
        : undefined,
    ),
  ])
  if (
    method === undefined ||
    fee === undefined ||
    minimumAmount === undefined ||
    maximumAmount === undefined ||
    sortOrder === null ||
    sortOrder === undefined ||
    Object.keys(errors).length > 0
  ) {
    return { type: 'invalid', errors }
  }

  return {
    type: 'valid',
    value: {
      method,
      displayName,
      description: textOrNull(textOf(values, 'description')),
      processorName,
      fee,
      minimumAmount,
      maximumAmount,
      isOnlineEnabled: values.has('isOnlineEnabled'),
      isOfflineEnabled: values.has('isOfflineEnabled'),
      sortOrder,
      isActive: values.has('isActive'),
    },
  }
}

/** A new payment method, as the form holds it. */
export const readPaymentMethodEntry = (
  values: FormData,
): FormRead<ModelsPaymentMethodCreateRequest, Errors> =>
  readWhole(values, undefined)

/** What a change of a payment method asks for: nothing, when nothing was changed. */
type PaymentMethodChange =
  | FormRead<ModelsPaymentMethodUpdateRequest, Errors>
  | { type: 'unchanged' }
/**
 * What was changed in the form: the values that are others than those of
 * the payment method it was opened with, each compared as the form reads
 * it. The kind is not sent: it is not changed.
 */
export const readPaymentMethodChange = (
  values: FormData,
  shown: ModelsPaymentMethodResponse,
): PaymentMethodChange => {
  const read = readWhole(values, shown.method)
  if (read.type === 'invalid') {
    return read
  }
  const sent = read.value
  const changes: ModelsPaymentMethodUpdateRequest = {
    ...(sent.displayName === shown.displayName.trim()
      ? {}
      : { displayName: sent.displayName }),
    ...(sent.description === textOrNull(shown.description)
      ? {}
      : { description: sent.description }),
    ...(sent.processorName === textOrNull(shown.processorName)
      ? {}
      : { processorName: sent.processorName }),
    ...(sent.fee === shown.fee ? {} : { fee: sent.fee }),
    ...(sent.minimumAmount === shown.minimumAmount
      ? {}
      : { minimumAmount: sent.minimumAmount }),
    ...(sent.maximumAmount === shown.maximumAmount
      ? {}
      : { maximumAmount: sent.maximumAmount }),
    ...(sent.isOfflineEnabled === shown.isOfflineEnabled
      ? {}
      : { isOfflineEnabled: sent.isOfflineEnabled }),
    ...(sent.isOnlineEnabled === shown.isOnlineEnabled
      ? {}
      : { isOnlineEnabled: sent.isOnlineEnabled }),
    ...(sent.sortOrder === shown.sortOrder
      ? {}
      : { sortOrder: sent.sortOrder }),
    ...(sent.isActive === shown.isActive ? {} : { isActive: sent.isActive }),
  }

  return Object.keys(changes).length === 0
    ? { type: 'unchanged' }
    : { type: 'valid', value: changes }
}

/** What is said at a control the API refused a value of. */
const refusalAt = (field: string, rule: string): LocalizedText =>
  match(field)
    .with('method', () => ERRORS.kind)
    .with('displayName', () => NAME_ERROR)
    .with('processorName', () => PROCESSOR_ERROR)
    .with('fee', () => ERRORS.fee)
    // A range the API compared with the amount it keeps: the other was changed meanwhile
    .with('minimumAmount', () =>
      rule === 'custom' ? ERRORS.rangeFromBelow : ERRORS.minimum,
    )
    .with('maximumAmount', () =>
      rule === 'custom' ? ERRORS.range : ERRORS.maximum,
    )
    .with('sortOrder', () => ERRORS.sortOrder)
    .otherwise(() => REFUSED_VALUE_MESSAGE)

/** What the form says after the API did not take it. */
export const afterPaymentMethodWrite = (
  outcome:
    | Extract<PaymentMethodWrite, { type: 'invalid' | 'forbidden' }>
    | { type: 'tooManyRequests' }
    | { type: 'failed' },
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.filter(({ field }) => CONTROLS.includes(field))

      return {
        message: said.length === 0 ? CHECK_THE_VALUES_MESSAGE : undefined,
        errors: Object.fromEntries(
          said.map(({ field, rule }) => [field, refusalAt(field, rule)]),
        ),
      }
    })
    .with({ type: 'forbidden' }, () => aboutTheAttempt(form.forbidden))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(form.failed))
    .exhaustive()

/**
 * What is said after a payment method was to be removed. One that a
 * payment was received by stays: the salon stops using it instead.
 */
export const afterPaymentMethodRemoval = (
  outcome: PaymentMethodRemoval,
  name: string,
): TreatmentRemovalSays =>
  match(outcome)
    .returnType<TreatmentRemovalSays>()
    .with({ type: 'removed' }, () => ({
      type: 'done',
      message: removal.done(name),
    }))
    .with({ type: 'inUse' }, () => ({
      type: 'refused',
      message: removal.inUse(name),
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: form.forbidden,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: removal.failed,
    }))
    .exhaustive()
