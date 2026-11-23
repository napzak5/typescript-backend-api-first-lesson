import {
  CHECK_THE_VALUES_MESSAGE,
  REFUSED_VALUE_MESSAGE,
  type RefusedValue,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsSaleResponse,
  ModelsSaleUpdateRequest,
  ModelsSaleVoidRequest,
} from '@beauty-salon-frontend/api-client'
import { isDay } from '@beauty-salon-frontend/fields'
import { dayAt, momentOf, timeAt } from '@beauty-salon-frontend/salon-screens'
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
import {
  adminBookingMessages,
  adminSaleMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import { NO_CASHIER } from './checkout'

/*
 * Changing a sale after it was entered, and voiding it: what can be
 * changed, what the forms send, and what is said about the answers.
 */

const { change, void: voiding } = adminSaleMessages.changes

/** The roles that may void a sale and give its payments back: money goes out */
const UNDOERS: readonly string[] = ['owner', 'manager', 'admin']

/** Whether an account of the role may void a sale and give its payments back. */
export const mayUndoSales = (role: string): boolean => UNDOERS.includes(role)

/** Why a sale is not changed, in a sentence; `undefined` when it is. */
export const whyUnchangeable = ({
  isVoid,
}: Pick<ModelsSaleResponse, 'isVoid'>): LocalizedText | undefined =>
  isVoid ? change.voided : undefined

/** When a sale was entered, as the form shows it: the day and the time on the clock of the salon. */
export const saleMomentOf = (
  saleTime: string,
  timezone: string,
): { date: string; time: string } => ({
  date: dayAt(new Date(saleTime), timezone),
  time: timeAt(saleTime, timezone),
})

/** What a change of a sale asks for: nothing, when nothing was changed. */
export type SaleChange =
  | FormRead<ModelsSaleUpdateRequest, FormErrors<LocalizedText>>
  | { type: 'unchanged' }

/** The sale as the form was opened with it */
type Changed = Pick<ModelsSaleResponse, 'staffId' | 'saleTime' | 'notes'>

/**
 * The properties the form changed, compared with the sale it was opened
 * with: what somebody else wrote meanwhile stays, unless the same property
 * was changed here. The time is sent only when its day or its time of day
 * was changed, so that a sale keeps the seconds it was entered at; it is
 * read on the clock of the salon, and a sale is a record of what took
 * place, never of a time to come.
 */
export const readSaleChange = (
  values: FormData,
  sale: Changed,
  timezone: string,
  now: Date,
): SaleChange => {
  const member = textOf(values, 'staffId')
  const staffId = member === NO_CASHIER || member === '' ? null : member
  const date = textOf(values, 'saleDate')
  const time = textOf(values, 'saleTime')
  const notes = textOrNull(textOf(values, 'notes'))
  const shown = saleMomentOf(sale.saleTime, timezone)
  const moved = date !== shown.date || time !== shown.time
  const saleTime =
    moved && isDay(date) && time !== ''
      ? momentOf(`${date}T${time}`, timezone)
      : undefined
  const errors: FormErrors<LocalizedText> = moved
    ? {
        ...(isDay(date) ? {} : { saleDate: change.errors.saleDate }),
        ...(time === '' ? { saleTime: change.errors.saleTime } : {}),
        ...(isDay(date) && time !== '' && saleTime === undefined
          ? { saleTime: adminBookingMessages.notOnTheClock }
          : {}),
        ...(saleTime !== undefined && Date.parse(saleTime) > now.getTime()
          ? { saleTime: change.errors.later }
          : {}),
      }
    : NO_ERRORS
  if (Object.keys(errors).length > 0) {
    return { type: 'invalid', errors }
  }
  const changes: ModelsSaleUpdateRequest = {
    ...(staffId === sale.staffId ? {} : { staffId }),
    ...(saleTime === undefined ? {} : { saleTime }),
    ...(notes === textOrNull(sale.notes ?? '') ? {} : { notes }),
  }

  return Object.keys(changes).length === 0
    ? { type: 'unchanged' }
    : { type: 'valid', value: changes }
}

/** What came of an attempt to change a sale, after the API was asked why it refused. */
export type SaleChangeAttempt =
  | { type: 'updated'; sale: ModelsSaleResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /** The sale as it is now: it was voided meanwhile */
  | { type: 'refused'; sale: ModelsSaleResponse }
  /** The sale is not void: the time zone of the salon is no name, and gives the time no day */
  | { type: 'undated' }
  | { type: 'notFound' }
  | { type: 'forbidden' }
  | { type: 'tooManyRequests' }
  | { type: 'failed' }

const CHANGE_CONTROLS: readonly string[] = ['staffId', 'saleTime', 'notes']

/** What is said at a control of a value the API refused. */
const changeMessageAt = ({ field, rule }: RefusedValue): LocalizedText =>
  match([field, rule])
    .with(['staffId', 'not_found'], () => change.errors.staffGone)
    .otherwise(() => REFUSED_VALUE_MESSAGE)

/**
 * What the form that changes a sale says after the API did not change it.
 * A sale that is gone, or that was voided meanwhile, is no failure of the
 * form: the screen shows it as it is now.
 */
export const afterSaleChange = (
  outcome: Exclude<
    SaleChangeAttempt,
    { type: 'updated' } | { type: 'refused' } | { type: 'notFound' }
  >,
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) => {
      const atControls = values.filter(({ field }) =>
        CHANGE_CONTROLS.includes(field),
      )

      return {
        message: atControls.length === 0 ? CHECK_THE_VALUES_MESSAGE : undefined,
        errors: Object.fromEntries(
          atControls
            .toReversed()
            .map((value) => [value.field, changeMessageAt(value)]),
        ),
      }
    })
    .with({ type: 'undated' }, () => aboutTheAttempt(change.undated))
    .with({ type: 'forbidden' }, () => aboutTheAttempt(change.forbidden))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(change.failed))
    .exhaustive()

/**
 * Why a sale is not voided, in a sentence; `undefined` when it is. The API
 * refuses a sale with a payment that was received and not given back
 * whole. A payment given back in part is not given back again, so its
 * sale stays; one that was received is given back first.
 */
export const whyNoVoid = ({
  isVoid,
  payments,
}: Pick<ModelsSaleResponse, 'isVoid' | 'payments'>):
  | LocalizedText
  | undefined => {
  if (isVoid) {
    return voiding.why.voided
  }
  if (payments.some(({ status }) => status === 'partial_refund')) {
    return voiding.why.partlyRefunded
  }
  if (payments.some(({ status }) => status === 'completed')) {
    return voiding.why.received
  }

  return undefined
}

/** Why a sale is voided, from the form of the dialog: the voided sale stays in the ledger, and says why. */
export const readVoid = (
  values: FormData,
): FormRead<ModelsSaleVoidRequest, FormErrors<LocalizedText>> => {
  const voidReason = textOrNull(textOf(values, 'voidReason'))

  return voidReason === null
    ? { type: 'invalid', errors: { voidReason: voiding.reasonMissing } }
    : { type: 'valid', value: { voidReason } }
}

/** What came of an attempt to void a sale, after the API was asked why it refused. */
export type VoidAttempt =
  | { type: 'voided'; sale: ModelsSaleResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /** The sale as it is now: voided, or paid, meanwhile */
  | { type: 'refused'; sale: ModelsSaleResponse }
  | { type: 'notFound' }
  | { type: 'forbidden' }
  | { type: 'tooManyRequests' }
  | { type: 'failed' }

/** What follows an attempt to void a sale. */
export type VoidSays =
  | { type: 'done'; sale: ModelsSaleResponse }
  /** Nothing was done, and nothing is known to have changed: said in the dialog */
  | ({ type: 'again' } & FormSays<LocalizedText>)
  /** The sale changed meanwhile: the dialog closes, and the page shows it as it is now */
  | { type: 'refused'; sale: ModelsSaleResponse; message: LocalizedText }
  /** The sale is gone: the screen says that there is none */
  | { type: 'gone' }

const VOID_AGAIN = voiding.failed

export const afterVoid = (outcome: VoidAttempt): VoidSays =>
  match(outcome)
    .returnType<VoidSays>()
    .with({ type: 'voided' }, ({ sale }) => ({ type: 'done', sale }))
    .with({ type: 'invalid' }, ({ values }) =>
      values.some(({ field }) => field === 'voidReason')
        ? {
            type: 'again',
            message: undefined,
            errors: { voidReason: voiding.reasonMissing },
          }
        : { type: 'again', ...aboutTheAttempt(VOID_AGAIN) },
    )
    .with({ type: 'refused' }, ({ sale }) => {
      const why = whyNoVoid(sale)
      if (why === undefined) {
        return { type: 'again', ...aboutTheAttempt(VOID_AGAIN) }
      }

      return {
        type: 'refused',
        sale,
        message: sale.isVoid
          ? voiding.voidedMeanwhile
          : voiding.paymentsChanged(why),
      }
    })
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'forbidden' }, () => ({
      type: 'again',
      ...aboutTheAttempt(voiding.forbidden),
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      ...aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      ...aboutTheAttempt(VOID_AGAIN),
    }))
    .exhaustive()
