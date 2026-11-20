import type {
  ModelsSaleResponse,
  ModelsSaleUpdateRequest,
  ModelsSaleVoidRequest,
} from '@beauty-salon-frontend/api-client'
import { match } from 'ts-pattern'
import { type Read, textOf } from '../bookings/booking-actions'
import {
  type FormSays,
  NOT_ON_THE_CLOCK,
  nullIfBlank,
  TOO_MANY_REQUESTS,
} from '../bookings/booking-entry'
import type { RefusedValue } from '../reading'
import { dayAt, isDay, momentOf, timeOfDayAt } from '../salon-time'
import { NO_CASHIER } from './checkout'

/*
 * Changing a sale after it was entered, and voiding it: what can be
 * changed, what the forms send, and what is said about the answers.
 */

/** The roles that may void a sale and give its payments back: money goes out */
const UNDOERS: readonly string[] = ['owner', 'manager', 'admin']

/** Whether an account of the role may void a sale and give its payments back. */
export const mayUndoSales = (role: string): boolean => UNDOERS.includes(role)

/** What a member of the staff is told where a sale would be voided or given back. */
export const UNDONE_BY_OTHERS =
  '売上の取り消しと返金は、オーナーとマネージャーができます。'

/** Why a sale is not changed, in a sentence; `undefined` when it is. */
export const whyUnchangeable = ({
  isVoid,
}: Pick<ModelsSaleResponse, 'isVoid'>): string | undefined =>
  isVoid
    ? '取り消した売上は、直せません。取り消しの記録として残ります。'
    : undefined

/** When a sale was entered, as the form shows it: the day and the time on the clock of the salon. */
export const saleMomentOf = (
  saleTime: string,
  timezone: string,
): { date: string; time: string } => ({
  date: dayAt(new Date(saleTime), timezone),
  time: timeOfDayAt(saleTime, timezone),
})

/** What a change of a sale asks for: nothing, when nothing was changed. */
export type SaleChange = Read<ModelsSaleUpdateRequest> | { type: 'unchanged' }

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
  const notes = nullIfBlank(textOf(values, 'notes'))
  const shown = saleMomentOf(sale.saleTime, timezone)
  const moved = date !== shown.date || time !== shown.time
  const saleTime =
    moved && isDay(date) && time !== ''
      ? momentOf(`${date}T${time}`, timezone)
      : undefined
  const errors: Record<string, string> = moved
    ? {
        ...(isDay(date) ? {} : { saleDate: '会計日を入力してください。' }),
        ...(time === '' ? { saleTime: '会計の時刻を入力してください。' } : {}),
        ...(isDay(date) && time !== '' && saleTime === undefined
          ? { saleTime: NOT_ON_THE_CLOCK }
          : {}),
        ...(saleTime !== undefined && Date.parse(saleTime) > now.getTime()
          ? { saleTime: '会計日時は、いまより前にしてください。' }
          : {}),
      }
    : {}
  if (Object.keys(errors).length > 0) {
    return { type: 'invalid', errors }
  }
  const changes: ModelsSaleUpdateRequest = {
    ...(staffId === sale.staffId ? {} : { staffId }),
    ...(saleTime === undefined ? {} : { saleTime }),
    ...(notes === nullIfBlank(sale.notes ?? '') ? {} : { notes }),
  }

  return Object.keys(changes).length === 0
    ? { type: 'unchanged' }
    : { type: 'valid', request: changes }
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
const changeMessageAt = ({ field, rule }: RefusedValue): string =>
  match([field, rule])
    .with(
      ['staffId', 'not_found'],
      () =>
        'このスタッフは、その間に削除されたため、選べません。選び直してください。',
    )
    .otherwise(
      () => 'この値は受け付けられませんでした。入力を確かめてください。',
    )

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
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) => {
      const atControls = values.filter(({ field }) =>
        CHANGE_CONTROLS.includes(field),
      )

      return {
        message:
          atControls.length === 0
            ? '入力した内容を確かめて、もう一度お試しください。'
            : undefined,
        errors: Object.fromEntries(
          atControls
            .toReversed()
            .map((value) => [value.field, changeMessageAt(value)]),
        ),
      }
    })
    .with({ type: 'undated' }, () => ({
      message:
        'サロンのタイムゾーンが正しくないため、会計日を決められず、会計日時を直せませんでした。サロンの設定を直してください。',
      errors: {},
    }))
    .with({ type: 'forbidden' }, () => ({
      message: 'このアカウントでは、この売上を直せません。',
      errors: {},
    }))
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS)
    .with({ type: 'failed' }, () => ({
      message:
        '売上を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
      errors: {},
    }))
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
}: Pick<ModelsSaleResponse, 'isVoid' | 'payments'>): string | undefined => {
  if (isVoid) {
    return 'この売上は、取り消されています。'
  }
  if (payments.some(({ status }) => status === 'partial_refund')) {
    return '一部を返金した支払いがあるため、この売上は取り消せません。1 件の支払いの返金は 1 回で、残りは返金できません。'
  }
  if (payments.some(({ status }) => status === 'completed')) {
    return '受け取った支払いがあるため、このままでは取り消せません。取り消す前に、支払いをすべて全額返金してください。'
  }

  return undefined
}

/** Why a sale is voided, from the form of the dialog: the voided sale stays in the ledger, and says why. */
export const readVoid = (values: FormData): Read<ModelsSaleVoidRequest> => {
  const voidReason = nullIfBlank(textOf(values, 'voidReason'))

  return voidReason === null
    ? {
        type: 'invalid',
        errors: { voidReason: '取り消しの理由を入力してください。' },
      }
    : { type: 'valid', request: { voidReason } }
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
  | {
      type: 'again'
      message: string | undefined
      errors: Record<string, string>
    }
  /** The sale changed meanwhile: the dialog closes, and the page shows it as it is now */
  | { type: 'refused'; sale: ModelsSaleResponse; message: string }
  /** The sale is gone: the screen says that there is none */
  | { type: 'gone' }

const VOID_AGAIN =
  '売上を取り消せませんでした。通信の状態を確かめて、もう一度お試しください。'

export const afterVoid = (outcome: VoidAttempt): VoidSays =>
  match(outcome)
    .returnType<VoidSays>()
    .with({ type: 'voided' }, ({ sale }) => ({ type: 'done', sale }))
    .with({ type: 'invalid' }, ({ values }) =>
      values.some(({ field }) => field === 'voidReason')
        ? {
            type: 'again',
            message: undefined,
            errors: { voidReason: '取り消しの理由を入力してください。' },
          }
        : { type: 'again', message: VOID_AGAIN, errors: {} },
    )
    .with({ type: 'refused' }, ({ sale }) => {
      const why = whyNoVoid(sale)
      if (why === undefined) {
        return { type: 'again', message: VOID_AGAIN, errors: {} }
      }

      return {
        type: 'refused',
        sale,
        message: sale.isVoid
          ? 'この売上は、その間に取り消されていました。'
          : `その間に、この売上の支払いが変わりました。${why}`,
      }
    })
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'forbidden' }, () => ({
      type: 'again',
      message: `このアカウントでは、売上を取り消せません。${UNDONE_BY_OTHERS}`,
      errors: {},
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message:
        'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      errors: {},
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: VOID_AGAIN,
      errors: {},
    }))
    .exhaustive()
