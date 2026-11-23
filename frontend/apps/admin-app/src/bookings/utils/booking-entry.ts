import {
  CHECK_THE_VALUES_MESSAGE,
  REFUSED_VALUE_MESSAGE,
  type RefusedValue,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsBookingCreateRequest,
  ModelsBookingServiceCreateRequest,
  ModelsBookingUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import { isDay } from '@beauty-salon-frontend/fields'
import { keywordIn, momentOf } from '@beauty-salon-frontend/salon-screens'
import {
  aboutTheAttempt,
  type FormRead,
  type FormSays,
  inJapanese,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import type {
  BookingCreation,
  BookingRemoval,
  BookingUpdate,
  LineCheck,
} from '../api/bookings-api'

/*
 * Putting a booking into the ledger, changing what the salon wrote down on
 * it, and removing it: what the address holds, what the forms send, and
 * what is said about the answers.
 */

/** What the address of the screen that puts a booking in holds. */
export type EntryChoice = {
  /** The day of the visit the form opens with: that of the list it was opened from */
  date: string
  /** The keyword the customers were searched by */
  search: string | undefined
  /** The customer who was chosen */
  customerId: string | undefined
}

const SEARCH = 'search'

/** What an address chose. A day that is none, or that the API does not take, is today. */
export const entryChoiceIn = (
  query: URLSearchParams,
  today: string,
): EntryChoice => {
  const date = query.get('date') ?? ''
  const customerId = (query.get('customerId') ?? '').trim()

  return {
    date: isDay(date) ? date : today,
    search: keywordIn(query, SEARCH),
    customerId: customerId === '' ? undefined : customerId,
  }
}

/** The query that keeps a choice in an address, in one order. */
export const entryQueryOf = ({
  date,
  search,
  customerId,
}: EntryChoice): URLSearchParams => {
  const entries: [string, string][] = [['date', date]]
  if (search !== undefined) {
    entries.push([SEARCH, search])
  }
  if (customerId !== undefined) {
    entries.push(['customerId', customerId])
  }

  return new URLSearchParams(entries)
}

/** The most lines a booking has */
export const MOST_LINES = 20

/** The member of a line, beside a member of the staff: the one of the booking */
export const SAME_STAFF = 'same'

/** The member of a line, beside a member of the staff: nobody, who is taken by it */
export const NO_STAFF = 'none'

/** The name of a control of a line, as the API names the value in what it refuses. */
export const lineControlOf = (
  index: number,
  part: keyof ModelsBookingServiceCreateRequest,
): string => `services.${index}.${part}`

const SERVICE_CONTROL = /^services\.\d+\.serviceId$/
/** The largest amount a booking holds */
const MOST_YEN = 2_147_483_647

/**
 * An amount in yen, as a person types it: digits of full width count, and
 * so do the commas between them. Nothing is no amount; what is no whole
 * number of yen the API takes is `undefined`.
 */
export const yenOf = (text: string): number | null | undefined => {
  const digits = text.normalize('NFKC').replaceAll(',', '').trim()
  if (digits === '') {
    return null
  }
  const amount = /^\d+$/.test(digits) ? Number(digits) : Number.NaN

  return amount <= MOST_YEN ? amount : undefined
}

export const DEPOSIT_ERROR = '予約金は、0 以上の円の整数で入力してください。'

/** What the salon writes down on a booking, beside who comes when for what. */
export type Notes = Pick<
  ModelsBookingCreateRequest,
  'depositAmount' | 'customerRequest' | 'internalNotes' | 'source'
>

/** What the salon wrote down, from the controls of `BookingNotesFields`. */
export const readNotes = (values: FormData): FormRead<Notes> => {
  const depositAmount = yenOf(textOf(values, 'depositAmount'))
  if (depositAmount === undefined) {
    return { type: 'invalid', errors: { depositAmount: DEPOSIT_ERROR } }
  }

  return {
    type: 'valid',
    value: {
      depositAmount,
      customerRequest: textOrNull(textOf(values, 'customerRequest')),
      internalNotes: textOrNull(textOf(values, 'internalNotes')),
      source: textOrNull(textOf(values, 'source')),
    },
  }
}

/** Who a booking is for and when, as the form has it: the member of the booking and the lines. */
export type Lines = Pick<ModelsBookingCreateRequest, 'staffId' | 'services'>

export const NOT_ON_THE_CLOCK =
  'サロンの時計で、この日にない時刻です（夏時間の始まり）。別の時刻を入力してください。'

/** The day of the visit, the member of the booking, and the clock the times are read on. */
export type LineDay = {
  /** `undefined` while the form has no day */
  date: string | undefined
  staffId: string
  timezone: string
}

/**
 * A line, from its controls, whose names `control` gives: those of a row of
 * the form that puts a booking in, or those of the form that adds one line.
 * It begins on the day of the visit; a line whose member is that of the
 * booking names the member.
 */
export const readLine = (
  values: FormData,
  control: (part: keyof ModelsBookingServiceCreateRequest) => string,
  { date, staffId, timezone }: LineDay,
): FormRead<ModelsBookingServiceCreateRequest> => {
  const serviceId = textOf(values, control('serviceId'))
  const time = textOf(values, control('startTime'))
  const member = textOf(values, control('staffId'))
  const startTime =
    date === undefined || time === ''
      ? undefined
      : momentOf(`${date}T${time}`, timezone)
  const errors: Record<string, string> = {
    ...(serviceId === ''
      ? { [control('serviceId')]: 'メニューを選んでください。' }
      : {}),
    ...(time === ''
      ? { [control('startTime')]: '開始の時刻を入力してください。' }
      : {}),
    ...(date !== undefined && time !== '' && startTime === undefined
      ? { [control('startTime')]: NOT_ON_THE_CLOCK }
      : {}),
  }
  if (startTime === undefined || Object.keys(errors).length > 0) {
    return { type: 'invalid', errors }
  }

  return {
    type: 'valid',
    value: {
      serviceId,
      staffId: match(member)
        .with(SAME_STAFF, () => staffId)
        .with(NO_STAFF, () => null)
        .otherwise((id) => id),
      startTime,
      notes: textOrNull(textOf(values, control('notes'))),
    },
  }
}

/**
 * The member of the staff of a booking and its lines. Every line begins on
 * the day of the visit, at a time of the clock of the salon; a line whose
 * member is that of the booking names the member.
 */
export const readLines = (
  values: FormData,
  timezone: string,
): FormRead<Lines> => {
  const staffId = textOf(values, 'staffId')
  const day = textOf(values, 'date')
  const date = isDay(day) ? day : undefined
  const count = [...values.keys()].filter((name) =>
    SERVICE_CONTROL.test(name),
  ).length
  const lines = Array.from({ length: count }, (_, index) =>
    readLine(values, (part) => lineControlOf(index, part), {
      date,
      staffId,
      timezone,
    }),
  )
  const errors: Record<string, string> = Object.assign(
    {
      ...(staffId === '' ? { staffId: '担当スタッフを選んでください。' } : {}),
      ...(date === undefined ? { date: '来店日を入力してください。' } : {}),
    },
    ...lines.map((line) => (line.type === 'invalid' ? line.errors : {})),
  )
  if (Object.keys(errors).length > 0) {
    return { type: 'invalid', errors }
  }

  return {
    type: 'valid',
    value: {
      staffId,
      services: lines.flatMap((line) =>
        line.type === 'valid' ? [line.value] : [],
      ),
    },
  }
}

/** The booking of a customer at a salon, from the form that puts it in. */
export const readEntry = (
  values: FormData,
  {
    salonId,
    customerId,
    timezone,
  }: { salonId: string; customerId: string; timezone: string },
): FormRead<ModelsBookingCreateRequest> => {
  const lines = readLines(values, timezone)
  const notes = readNotes(values)
  if (lines.type === 'invalid' || notes.type === 'invalid') {
    return {
      type: 'invalid',
      errors: {
        ...(lines.type === 'invalid' ? lines.errors : {}),
        ...(notes.type === 'invalid' ? notes.errors : {}),
      },
    }
  }

  return {
    type: 'valid',
    value: { salonId, customerId, ...lines.value, ...notes.value },
  }
}

/** What a change of the notes of a booking asks for: nothing, when nothing was changed. */
export type NotesChange =
  | FormRead<ModelsBookingUpdateRequest>
  | { type: 'unchanged' }

/**
 * The properties the form changed, compared with the booking it was opened
 * with as they are sent: what somebody else wrote meanwhile stays, unless
 * the same property was changed here.
 */
export const readNotesChange = (
  values: FormData,
  shown: Notes,
): NotesChange => {
  const read = readNotes(values)
  if (read.type === 'invalid') {
    return read
  }
  const { depositAmount, customerRequest, internalNotes, source } = read.value
  const before = (text: string | null): string | null => textOrNull(text ?? '')
  const changes: ModelsBookingUpdateRequest = {
    ...(depositAmount === shown.depositAmount ? {} : { depositAmount }),
    ...(customerRequest === before(shown.customerRequest)
      ? {}
      : { customerRequest }),
    ...(internalNotes === before(shown.internalNotes) ? {} : { internalNotes }),
    ...(source === before(shown.source) ? {} : { source }),
  }

  return Object.keys(changes).length === 0
    ? { type: 'unchanged' }
    : { type: 'valid', value: changes }
}

/** How a booking reached the salon, as the form offers it. */
export const SOURCES: readonly { value: string; label: string }[] = [
  { value: 'phone', label: '電話' },
  { value: 'walk_in', label: '店頭' },
  { value: 'email', label: 'メール' },
  { value: 'other', label: 'その他' },
]

/** A booking a customer made in the portal */
const SOURCE_NAMES: Record<string, string> = {
  online: 'オンライン',
  ...Object.fromEntries(SOURCES.map(({ value, label }) => [value, label])),
}

/** How a booking reached the salon, in words: a value of another kind, as it is. */
export const sourceNameOf = (source: string): string =>
  SOURCE_NAMES[source] ?? source
/** What is said about a value the API refused at its control. */
const messageAt = ({ field, rule }: RefusedValue): string =>
  match([field, rule])
    .when(
      ([refused, broken]) =>
        broken === 'not_found' && refused.endsWith('serviceId'),
      () => 'このメニューは、もう選べません。選び直してください。',
    )
    .when(
      ([, broken]) => broken === 'not_found',
      () => 'このスタッフは、もう選べません。選び直してください。',
    )
    .when(
      ([refused]) => refused === 'depositAmount',
      () => DEPOSIT_ERROR,
    )
    .otherwise(() => inJapanese(REFUSED_VALUE_MESSAGE))

/** What is said about a value the API refused that the form has no control for. */
const ATTEMPT_MESSAGES: Record<string, string> = {
  customerId:
    'このお客様は、台帳から削除されていました。お客様を選び直してください。',
  services:
    '金額の合計が、1 件の予約で扱える上限を超えます。明細を減らしてください。',
}

/**
 * What a form says of the values the API refused: at the control of each,
 * the first that names it; about the attempt for a value that has none.
 */
export const afterRefusal = (
  values: readonly RefusedValue[],
  hasControl: (field: string) => boolean,
): FormSays => {
  const atControls = values.filter(({ field }) => hasControl(field))
  const aboutAttempt = values.flatMap(({ field }) => {
    const message = ATTEMPT_MESSAGES[field]

    return hasControl(field) || message === undefined ? [] : [message]
  })
  if (atControls.length === 0 && aboutAttempt.length === 0) {
    return aboutTheAttempt(inJapanese(CHECK_THE_VALUES_MESSAGE))
  }

  return {
    message: aboutAttempt[0],
    errors: Object.fromEntries(
      atControls.toReversed().map((value) => [value.field, messageAt(value)]),
    ),
  }
}

const NOTES_CONTROLS: readonly string[] = [
  'depositAmount',
  'customerRequest',
  'internalNotes',
  'source',
]

const LINE_CONTROL = /^services\.\d+\.(serviceId|staffId|startTime|notes)$/

const isEntryControl = (field: string): boolean =>
  field === 'staffId' ||
  NOTES_CONTROLS.includes(field) ||
  LINE_CONTROL.test(field)

/** What is said when a member of the staff is taken at a time of the booking. */
export const TAKEN =
  '担当の時間が、ほかの予約と重なっているため、予約を入れられませんでした。明細ごとに、担当の空きを確かめ直しました。'

/** What the form that puts a booking in says after the API did not create it. */
export const afterEntry = (
  outcome: Exclude<BookingCreation, { type: 'created' }>,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) =>
      afterRefusal(values, isEntryControl),
    )
    .with({ type: 'conflict' }, () => aboutTheAttempt(TAKEN))
    .with({ type: 'forbidden' }, () =>
      aboutTheAttempt('このアカウントでは、このサロンの予約を入れられません。'),
    )
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(inJapanese(TOO_MANY_REQUESTS_MESSAGE)),
    )
    .with({ type: 'failed' }, () =>
      aboutTheAttempt(
        '予約を入れられませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    )
    .exhaustive()

/**
 * What the form that changes the notes of a booking says after the API did
 * not change them. A booking that is gone is no failure of the form.
 */
export const afterNotesChange = (
  outcome: Exclude<BookingUpdate, { type: 'updated' } | { type: 'notFound' }>,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) =>
      afterRefusal(values, (field) => NOTES_CONTROLS.includes(field)),
    )
    .with({ type: 'forbidden' }, () =>
      aboutTheAttempt('このアカウントでは、この予約を変えられません。'),
    )
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(inJapanese(TOO_MANY_REQUESTS_MESSAGE)),
    )
    .with({ type: 'failed' }, () =>
      aboutTheAttempt(
        '予約の記録を変えられませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    )
    .exhaustive()

/** What follows an attempt to remove a booking. */
export type RemovalSays =
  /** The booking is gone from the ledger: the screen leads to the day of it */
  | { type: 'done' }
  /** Nothing was done, and nothing is known to have changed: said in the dialog */
  | { type: 'again'; message: string }
  /** The booking stays, and will: the dialog closes, and the page says why */
  | { type: 'refused'; message: string }
  /** The booking was gone already: it is read again, and the screen says so */
  | { type: 'gone' }

export const afterRemoval = (outcome: BookingRemoval): RemovalSays =>
  match(outcome)
    .returnType<RemovalSays>()
    .with({ type: 'deleted' }, () => ({ type: 'done' }))
    .with({ type: 'referred' }, () => ({
      type: 'refused',
      message:
        'この予約は、売上、施術記録、レビューのどれかが指しているため、削除できません。行われた来店の記録として残ります。',
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message:
        'このアカウントでは、予約を削除できません。行われない予約は、キャンセルしてください。',
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: inJapanese(TOO_MANY_REQUESTS_MESSAGE),
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message:
        '予約を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()

/** The numbers of lines, as a sentence lists them: 「明細 1、3」. */
const linesNamed = (indices: readonly number[]): string =>
  `明細 ${indices.map((index) => index + 1).join('、')}`

/** What a check of the members of the lines found, in a sentence. */
export const checkedSaysOf = (checks: readonly LineCheck[]): string => {
  const indicesOf = (type: LineCheck['type']): number[] =>
    checks.flatMap((check, index) => (check.type === type ? [index] : []))
  const unread = indicesOf('failed')
  const taken = indicesOf('taken')
  if (indicesOf('tooManyRequests').length > 0) {
    return inJapanese(TOO_MANY_REQUESTS_MESSAGE)
  }
  if (unread.length > 0) {
    return `${linesNamed(unread)} の担当の空きを確かめられませんでした。通信の状態を確かめて、もう一度お試しください。`
  }
  if (taken.length > 0) {
    return `${linesNamed(taken)} の担当に、重なる予約があります。担当の前後の空け時間も、重なりに数えます。担当か開始の時刻を変えてください。`
  }
  if (indicesOf('unassigned').length === checks.length) {
    return '担当を決めた明細がありません。担当を決めない明細は、誰の時間も占有しません。'
  }

  return '担当の空きを確かめました。重なる予約はありません。'
}
