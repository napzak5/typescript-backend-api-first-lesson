import {
  type Forbidden,
  type RefusedValue,
  TOO_MANY_REQUESTS_MESSAGE,
  UNREAD_TYPES,
  type Unread,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsCustomerResponse,
  ModelsPointAdjustRequest,
  ModelsPointEarnRequest,
  ModelsPointTransactionResponse,
  ModelsPointTransactionType,
  ModelsPointUseRequest,
  ModelsSaleResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { isDay, LATEST_DAY } from '@beauty-salon-frontend/fields'
import { amountOf, momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  aboutTheAttempt,
  type FormErrors,
  type FormRead,
  type FormSays,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match, P } from 'ts-pattern'
import type { SaleRead } from '../../sales/api/sales-api'
import type { CustomerRead } from '../api/customers-api'

const { points: words } = adminCustomerMessages
const { recorded, refusals } = words

/*
 * The points of a customer: what a form records, what is said about the
 * answer, and the words of the history. The points are the customer's,
 * not a salon's: they are earned at one salon and used at another.
 */

/**
 * What a form records: points given at the counter, points a customer
 * used, and the two ways of an adjustment. Every count is typed as a
 * positive number; the kind says which way the balance moves.
 */
export type PointKind = 'earned' | 'used' | 'added' | 'taken'

/** The roles that may adjust points beside the counter's records */
const ADJUSTERS: readonly string[] = ['owner', 'manager', 'admin']

/** Whether an account of the role may adjust points. */
export const mayAdjustPoints = (role: string): boolean =>
  ADJUSTERS.includes(role)

/**
 * What the account of the role that is signed in may record: the counter's
 * kinds, and the adjustments of an owner or a manager. While nobody is known
 * to be signed in (`undefined`), the counter's kinds.
 */
export const pointKindsFor = (
  role: string | undefined,
): readonly PointKind[] =>
  role !== undefined && mayAdjustPoints(role)
    ? ['earned', 'used', 'added', 'taken']
    : ['earned', 'used']

const KIND_NAMES: Record<PointKind, LocalizedText> = words.kinds

/** What a kind records, as the form offers it. */
export const kindNameOf = (kind: PointKind): LocalizedText => KIND_NAMES[kind]

/** The kind an address asks for: points used when it says so, points given otherwise. */
export const pointKindIn = (search: URLSearchParams): PointKind =>
  search.get('kind') === 'used' ? 'used' : 'earned'

const TRANSACTION_NAMES: Record<ModelsPointTransactionType, LocalizedText> =
  words.transactions

/** What a transaction of the history was, in a word: 「付与」. */
export const transactionNameOf = (
  type: ModelsPointTransactionType,
): LocalizedText => TRANSACTION_NAMES[type]

/** How a transaction moved the balance, with its sign: 「+500」, 「−200」. */
export const movementOf = (points: number): LocalizedText =>
  words.movementOf(points)

/** The largest balance a customer may have, and the largest count of a transaction */
const MOST_POINTS = 2_147_483_647

/**
 * A count of points, as a person types it: digits of full width count, and
 * so do the commas between them. Nothing is no count; what is no whole
 * number from 1 to the largest is `undefined`.
 */
const pointsOf = (text: string): number | null | undefined => {
  const digits = text.normalize('NFKC').replaceAll(',', '').trim()
  if (digits === '') {
    return null
  }
  const count = /^\d+$/.test(digits) ? Number(digits) : 0

  return count >= 1 && count <= MOST_POINTS ? count : undefined
}

const KIND_ERROR = words.form.kindMissing

const POINTS_ERROR = words.form.pointsError(MOST_POINTS)

const EXPIRY_IN_THE_PAST = words.form.expiryInThePast

const EXPIRY_ERROR = words.form.expiryError(formats.dayOf(LATEST_DAY))

/** The request a form makes, for the operation of its kind. */
export type PointRecording =
  | { type: 'earn'; request: ModelsPointEarnRequest }
  | { type: 'use'; request: ModelsPointUseRequest }
  | { type: 'adjust'; request: ModelsPointAdjustRequest }

/** What a form records about, beside what is typed into it. */
export type PointContext = {
  customerId: string
  /** The kinds the account may record */
  kinds: readonly PointKind[]
  /** Today at the salon: points given expire no earlier */
  today: string
  /** The sale the form offers to record the points for, when there is one: its box is checked to record them so */
  offeredSale: string | null
}

const kindIn = (
  values: FormData,
  kinds: readonly PointKind[],
): PointKind | undefined => {
  const chosen = textOf(values, 'kind')

  return kinds.find((kind) => kind === chosen)
}

/** What is wrong with the day the points given expire on: not a day, or one that is past. */
const expiryErrorOf = (
  expiryDate: string | null,
  today: string,
): LocalizedText | undefined => {
  if (expiryDate === null) {
    return undefined
  }
  if (!isDay(expiryDate)) {
    return EXPIRY_ERROR
  }

  return expiryDate < today ? EXPIRY_IN_THE_PAST : undefined
}

/**
 * The points a form records: their kind, a count of at least 1, the day the
 * points given expire on (none, or today or later at the salon), why they
 * move, and the sale they are recorded for, when its box is checked.
 */
export const readPointRecording = (
  values: FormData,
  { customerId, kinds, today, offeredSale }: PointContext,
): FormRead<PointRecording, FormErrors<LocalizedText>> => {
  const kind = kindIn(values, kinds)
  const saleId =
    offeredSale !== null && textOf(values, 'saleId') === offeredSale
      ? offeredSale
      : null
  const points = pointsOf(textOf(values, 'points'))
  const expiryDate =
    kind === 'earned' ? textOrNull(textOf(values, 'expiryDate')) : null
  const expiryError = expiryErrorOf(expiryDate, today)
  const errors = {
    ...(kind === undefined ? { kind: KIND_ERROR } : {}),
    ...(points === null || points === undefined
      ? { points: POINTS_ERROR }
      : {}),
    ...(expiryError === undefined ? {} : { expiryDate: expiryError }),
  }
  if (
    kind === undefined ||
    points === null ||
    points === undefined ||
    Object.keys(errors).length > 0
  ) {
    return { type: 'invalid', errors }
  }
  const common: ModelsPointUseRequest = {
    customerId,
    points,
    description: textOrNull(textOf(values, 'description')),
    referenceType: saleId === null ? null : 'sale',
    referenceId: saleId,
  }

  return {
    type: 'valid',
    value: match(kind)
      .returnType<PointRecording>()
      .with('earned', () => ({
        type: 'earn',
        request: { ...common, expiryDate },
      }))
      .with('used', () => ({ type: 'use', request: common }))
      .with('added', () => ({ type: 'adjust', request: common }))
      .with('taken', () => ({
        type: 'adjust',
        request: { ...common, points: -points },
      }))
      .exhaustive(),
  }
}

/** Why the API refused to record points, as the screen found out by reading the balance and the sale again. */
export type PointRefusal =
  | { type: 'voidSale' }
  /** The balance would fall below 0: the balance as it is now */
  | { type: 'short'; balance: number }
  | { type: 'over' }
  /** The sale has points of this kind already: they are given and used once for a sale */
  | { type: 'recordedAlready'; recording: 'earn' | 'use' }
  | { type: 'unknown' }

/**
 * Why a recording was refused with a conflict, from what was read after
 * it: the balance (`undefined` when it could not be read) and the sale it
 * was for (`undefined` when there is none, or it could not be read).
 */
export const whyRefused = (
  recording: PointRecording,
  balance: number | undefined,
  sale: Pick<ModelsSaleResponse, 'isVoid'> | undefined,
): PointRefusal => {
  if (sale?.isVoid === true && recording.type !== 'adjust') {
    return { type: 'voidSale' }
  }
  if (balance !== undefined) {
    const after =
      balance +
      (recording.type === 'use'
        ? -recording.request.points
        : recording.request.points)
    if (after < 0) {
      return { type: 'short', balance }
    }
    if (after > MOST_POINTS) {
      return { type: 'over' }
    }
  }

  return recording.type !== 'adjust' && recording.request.referenceId !== null
    ? { type: 'recordedAlready', recording: recording.type }
    : { type: 'unknown' }
}

/** The sale the address names for the points, as the form offers it. */
export type OfferedSale =
  | { type: 'sale'; id: string; name: LocalizedText }
  | { type: 'unusable'; why: LocalizedText }

/**
 * Whether the sale of the address can be what the points are recorded
 * for: a sale of the customer that is not void. Anything else is said, and
 * the points are recorded for no sale.
 */
export const offeredSaleOf = (
  read: SaleRead,
  customerId: string,
  { timezone, currency }: Pick<ModelsSalonResponse, 'timezone' | 'currency'>,
): OfferedSale =>
  match(read)
    .returnType<OfferedSale>()
    .with({ type: 'found' }, ({ sale }) => {
      if (sale.customerId === null) {
        return { type: 'unusable', why: words.sale.noCustomer }
      }
      if (sale.customerId !== customerId) {
        return { type: 'unusable', why: words.sale.otherCustomer }
      }
      if (sale.isVoid) {
        return { type: 'unusable', why: words.sale.voided }
      }

      return {
        type: 'sale',
        id: sale.id,
        name: words.sale.nameOf(
          sale.saleNumber,
          momentNameAt(sale.saleTime, timezone),
          amountOf(sale.totalAmount, currency),
        ),
      }
    })
    .with({ type: P.union('notFound', 'forbidden') }, () => ({
      type: 'unusable',
      why: words.sale.notFound,
    }))
    .with({ type: P.union(...UNREAD_TYPES) }, () => ({
      type: 'unusable',
      why: words.sale.unread,
    }))
    .exhaustive()

/** What came of an attempt to record points. */
export type PointAttempt =
  | { type: 'recorded'; transaction: ModelsPointTransactionResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  | { type: 'refused'; why: PointRefusal }
  | Forbidden
  | Unread

/** What the screen does after an attempt. */
export type PointSays =
  /** The points were recorded: the notification says what, and the balance */
  | {
      type: 'done'
      message: LocalizedText
      /** What the points left the customer with */
      balance: number
    }
  | ({ type: 'again' } & FormSays<LocalizedText>)
  /** The customer is not in the ledger any more */
  | { type: 'gone' }

const RECORD_AGAIN = refusals.failed

/** What the notification says of recorded points: what moved, and the balance after it. */
export const recordedMessageOf = ({
  transactionType,
  points,
  balance,
}: Pick<
  ModelsPointTransactionResponse,
  'transactionType' | 'points' | 'balance'
>): LocalizedText => {
  const moved = Math.abs(points)
  const done = match(transactionType)
    .returnType<LocalizedText>()
    .with('earned', () => recorded.earned(moved))
    .with('used', () => recorded.used(moved))
    .with('adjusted', () =>
      points > 0 ? recorded.added(moved) : recorded.taken(moved),
    )
    .with(P.union('expired', 'transferred'), () => recorded.other)
    .exhaustive()

  return recorded.withBalance(done, balance)
}

/** What is said of a refusal: at the count when it is the count that does not fit the balance. */
const refusalSays = (why: PointRefusal): FormSays<LocalizedText> =>
  match(why)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'voidSale' }, () => aboutTheAttempt(refusals.voidSale))
    .with({ type: 'short' }, ({ balance }) => ({
      message: undefined,
      errors: { points: refusals.short(balance) },
    }))
    .with({ type: 'over' }, () => ({
      message: undefined,
      errors: { points: refusals.over(MOST_POINTS) },
    }))
    .with({ type: 'recordedAlready', recording: 'earn' }, () =>
      aboutTheAttempt(refusals.earnedAlready),
    )
    .with({ type: 'recordedAlready', recording: 'use' }, () =>
      aboutTheAttempt(refusals.usedAlready),
    )
    .with({ type: 'unknown' }, () => aboutTheAttempt(RECORD_AGAIN))
    .exhaustive()

/** What is said at a control of a value the API refused. */
const messageAt = ({ field, rule }: RefusedValue): LocalizedText =>
  match([field, rule])
    .with(['expiryDate', 'too_small'], () => EXPIRY_IN_THE_PAST)
    .with(['expiryDate', P._], () => EXPIRY_ERROR)
    .otherwise(() => POINTS_ERROR)

const CONTROLS: readonly string[] = ['points', 'expiryDate']

/** What the screen says and does after an attempt to record points. */
export const afterRecording = (outcome: PointAttempt): PointSays =>
  match(outcome)
    .returnType<PointSays>()
    .with({ type: 'recorded' }, ({ transaction }) => ({
      type: 'done',
      message: recordedMessageOf(transaction),
      balance: transaction.balance,
    }))
    .with({ type: 'invalid' }, ({ values }) => {
      if (values.some(({ field }) => field === 'customerId')) {
        return { type: 'gone' }
      }
      if (values.some(({ field }) => field === 'referenceId')) {
        return {
          type: 'again',
          message: refusals.saleOfAnother,
          errors: {},
        }
      }
      const atControls = values.filter(({ field }) => CONTROLS.includes(field))

      return atControls.length === 0
        ? { type: 'again', message: RECORD_AGAIN, errors: {} }
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
    .with({ type: 'refused' }, ({ why }) => ({
      type: 'again',
      ...refusalSays(why),
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'again',
      message: refusals.forbidden,
      errors: {},
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      ...aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: RECORD_AGAIN,
      errors: {},
    }))
    .exhaustive()

/**
 * The record of the customer that was read, with the balance the points
 * left them: a screen that shows it before it is read anew shows the
 * balance after the points.
 */
export const withBalance = (
  customer: ModelsCustomerResponse,
  balance: number,
): CustomerRead => ({
  type: 'found',
  customer: { ...customer, loyaltyPoints: balance },
})
