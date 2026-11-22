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
  aboutTheAttempt,
  errorAt,
  type FormRead,
  type FormSays,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import { yenOf } from '../bookings/booking-entry'
import { numberOf } from '../treatments/treatment-form'
import type { TreatmentRemovalSays } from '../treatments/treatment-format'
import { METHOD_KINDS } from './payment-method-format'
import type {
  PaymentMethodRemoval,
  PaymentMethodWrite,
} from './payment-methods-api'

/*
 * The form of a payment method: what it sends, and what it says about the
 * answers.
 */

const LONGEST_NAME = 100
const LONGEST_FEE = 100

const KIND_ERROR = '種類を選んでください。'
const NAME_ERROR = `表示名を、${LONGEST_NAME} 文字までで入力してください。`
const PROCESSOR_ERROR = `決済代行会社の名前は、${LONGEST_NAME} 文字までで入力してください。`
const FEE_ERROR =
  '手数料率は、0 から 100 までの数（小数は 2 桁まで）で入力してください。'
const MINIMUM_ERROR = '下限は、1 以上の円の整数で入力してください。'
const MAXIMUM_ERROR = '上限は、1 以上の円の整数で入力してください。'
const RANGE_ERROR = '上限は、下限と同じか、下限より大きい金額にしてください。'
const ORDER_ERROR = '並び順は、0 以上の整数で入力してください。'

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
  message: string,
): string | undefined =>
  amount === undefined || amount === 0 ? message : undefined

/**
 * The whole payment method the form holds, or what is wrong with it. The
 * kind is that of the form when it offers one, or else that of the method
 * it was opened with: the kind of a method is not changed.
 */
const readWhole = (
  values: FormData,
  kept: ModelsPaymentMethodType | undefined,
): FormRead<ModelsPaymentMethodCreateRequest> => {
  const method =
    kept ?? METHOD_KINDS.find((one) => one === textOf(values, 'method'))
  const displayName = textOf(values, 'displayName').trim()
  const processorName = textOrNull(textOf(values, 'processorName'))
  const fee = numberOf(textOf(values, 'fee'), 2)
  const minimumAmount = yenOf(textOf(values, 'minimumAmount'))
  const maximumAmount = yenOf(textOf(values, 'maximumAmount'))
  const sortOrder = numberOf(textOf(values, 'sortOrder'), 0)
  const errors = Object.fromEntries([
    ...errorAt('method', method === undefined ? KIND_ERROR : undefined),
    ...errorAt(
      'displayName',
      displayName === '' || displayName.length > LONGEST_NAME
        ? NAME_ERROR
        : undefined,
    ),
    ...errorAt(
      'processorName',
      processorName !== null && processorName.length > LONGEST_NAME
        ? PROCESSOR_ERROR
        : undefined,
    ),
    ...errorAt(
      'fee',
      fee === undefined || (fee !== null && fee > LONGEST_FEE)
        ? FEE_ERROR
        : undefined,
    ),
    ...errorAt('minimumAmount', amountError(minimumAmount, MINIMUM_ERROR)),
    ...errorAt(
      'maximumAmount',
      amountError(maximumAmount, MAXIMUM_ERROR) ??
        (typeof minimumAmount === 'number' &&
        typeof maximumAmount === 'number' &&
        minimumAmount > maximumAmount
          ? RANGE_ERROR
          : undefined),
    ),
    ...errorAt(
      'sortOrder',
      sortOrder === null || sortOrder === undefined ? ORDER_ERROR : undefined,
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
): FormRead<ModelsPaymentMethodCreateRequest> => readWhole(values, undefined)

/** What a change of a payment method asks for: nothing, when nothing was changed. */
type PaymentMethodChange =
  | FormRead<ModelsPaymentMethodUpdateRequest>
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

/** What is said when the account may not keep the payment methods of the salon */
const FORBIDDEN_MESSAGE =
  'このサロンの支払い方法は、変えられません。支払い方法を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。'

/** What is said at a control the API refused a value of. */
const refusalAt = (field: string, rule: string): string =>
  match(field)
    .with('method', () => KIND_ERROR)
    .with('displayName', () => NAME_ERROR)
    .with('processorName', () => PROCESSOR_ERROR)
    .with('fee', () => FEE_ERROR)
    // A range the API compared with the amount it keeps: the other was changed meanwhile
    .with('minimumAmount', () =>
      rule === 'custom'
        ? '下限は、上限と同じか、上限より小さい金額にしてください。'
        : MINIMUM_ERROR,
    )
    .with('maximumAmount', () =>
      rule === 'custom' ? RANGE_ERROR : MAXIMUM_ERROR,
    )
    .with('sortOrder', () => ORDER_ERROR)
    .otherwise(() => REFUSED_VALUE_MESSAGE)

/** What the form says after the API did not take it. */
export const afterPaymentMethodWrite = (
  outcome:
    | Extract<PaymentMethodWrite, { type: 'invalid' | 'forbidden' }>
    | { type: 'tooManyRequests' }
    | { type: 'failed' },
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.filter(({ field }) => CONTROLS.includes(field))

      return {
        message: said.length === 0 ? CHECK_THE_VALUES_MESSAGE : undefined,
        errors: Object.fromEntries(
          said.map(({ field, rule }) => [field, refusalAt(field, rule)]),
        ),
      }
    })
    .with({ type: 'forbidden' }, () => aboutTheAttempt(FORBIDDEN_MESSAGE))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () =>
      aboutTheAttempt(
        '支払い方法を保存できませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    )
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
      message: `支払い方法「${name}」を削除しました。`,
    }))
    .with({ type: 'inUse' }, () => ({
      type: 'refused',
      message: `支払い方法「${name}」で受け取った支払いがあるので、削除できません。使うのをやめるときは、「この支払い方法を使う」の印を外して保存してください。`,
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: FORBIDDEN_MESSAGE,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message:
        '支払い方法を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()
