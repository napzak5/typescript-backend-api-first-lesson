import type { RefusedValue } from '@beauty-salon-frontend/answers'
import type {
  ModelsBookingRescheduleRequest,
  ModelsBookingResponse,
  ModelsBookingServiceCreateRequest,
  ModelsBookingServiceResponse,
  ModelsBookingStatusType,
} from '@beauty-salon-frontend/api-client'
import {
  isDay,
  momentOf,
  type Read,
  textOf,
} from '@beauty-salon-frontend/salon-screens'
import { match } from 'ts-pattern'
import {
  afterRefusal,
  type FormSays,
  MOST_LINES,
  NOT_ON_THE_CLOCK,
  readLine,
  TOO_MANY_REQUESTS,
} from './booking-entry'
import { statusNameOf } from './booking-format'
import type { LineCheck } from './bookings-api'

/*
 * Moving a booking to another time or another member of the staff, and
 * adding a line to it or taking one away: when the API takes each, what the
 * forms send, and what is said about the answers.
 */

/** The states of a booking that is moved: not begun, not closed */
const MOVABLE: readonly ModelsBookingStatusType[] = [
  'draft',
  'pending',
  'confirmed',
]

/** The states of a booking whose lines are changed: not finished. A treatment that began gets lines still */
const UNFINISHED: readonly ModelsBookingStatusType[] = [
  ...MOVABLE,
  'in_progress',
]

type WithStatus = Pick<ModelsBookingResponse, 'status'>

type WithLines = Pick<ModelsBookingResponse, 'status' | 'services'>

/** Whether the API moves a booking in its state. */
export const isMovable = ({ status }: WithStatus): boolean =>
  MOVABLE.includes(status)

/** Whether the API adds a line to a booking: it is not finished, and has fewer than the most lines. */
export const mayAddLine = ({ status, services }: WithLines): boolean =>
  UNFINISHED.includes(status) && services.length < MOST_LINES

/** Whether the API takes a line away from a booking: it is not finished, and the line is not its last. */
export const mayRemoveLine = ({ status, services }: WithLines): boolean =>
  UNFINISHED.includes(status) && services.length > 1

/** Why a booking is not moved, in a sentence; `undefined` for one that is. */
export const whyUnmovable = (booking: WithStatus): string | undefined =>
  isMovable(booking)
    ? undefined
    : `この予約は${statusNameOf(booking.status)}のため、日時と担当を変えられません。日時と担当を変えられるのは、下書き、確定待ち、確定の予約です。`

/** Why no line is added to a booking, in a sentence; `undefined` when one is. */
export const whyNoLineAdded = (booking: WithLines): string | undefined => {
  if (!UNFINISHED.includes(booking.status)) {
    return `この予約は${statusNameOf(booking.status)}のため、施術明細を足せません。施術明細を変えられるのは、下書き、確定待ち、確定、施術中の予約です。`
  }

  return booking.services.length < MOST_LINES
    ? undefined
    : `施術明細は ${MOST_LINES} 件までです。この予約には、もう足せません。`
}

/** Why a line stays on a booking, in a sentence; `undefined` when it is taken away. */
export const whyLineStays = (booking: WithLines): string | undefined => {
  if (!UNFINISHED.includes(booking.status)) {
    return `この予約は${statusNameOf(booking.status)}のため、施術明細を外せません。`
  }

  return booking.services.length > 1
    ? undefined
    : '予約に残る最後の明細は、外せません。行われない来店は、予約をキャンセルしてください。'
}

const byOrder = (
  one: Pick<ModelsBookingServiceResponse, 'sortOrder'>,
  other: Pick<ModelsBookingServiceResponse, 'sortOrder'>,
): number => one.sortOrder - other.sortOrder

/**
 * The lines of a booking as a move leaves them, in their order. The API
 * moves every line by as much as the beginning of the booking, so their
 * order and the time between them stay; the lines of the member of the
 * booking go to the new member, those of another member and those of
 * nobody stay theirs.
 */
export const movedLines = (
  booking: Pick<ModelsBookingResponse, 'startTime' | 'staffId' | 'services'>,
  { startTime, staffId }: ModelsBookingRescheduleRequest,
): ModelsBookingServiceResponse[] => {
  const by = Date.parse(startTime) - Date.parse(booking.startTime)
  const shifted = (moment: string): string =>
    new Date(Date.parse(moment) + by).toISOString()

  return booking.services.toSorted(byOrder).map((line) => ({
    ...line,
    startTime: shifted(line.startTime),
    endTime: shifted(line.endTime),
    staffId: line.staffId === booking.staffId ? staffId : line.staffId,
  }))
}

/** A line as a request names it, to check its member. */
export const lineRequestOf = ({
  serviceId,
  staffId,
  startTime,
  notes,
}: ModelsBookingServiceResponse): ModelsBookingServiceCreateRequest => ({
  serviceId,
  staffId,
  startTime,
  notes,
})

/**
 * Where a booking is moved to, from the form that moves it: the member of
 * the staff, and the beginning, a day and a time of the clock of the salon.
 */
export const readMove = (
  values: FormData,
  timezone: string,
): Read<ModelsBookingRescheduleRequest> => {
  const staffId = textOf(values, 'staffId')
  const date = textOf(values, 'date')
  const time = textOf(values, 'startTime')
  const startTime =
    isDay(date) && time !== ''
      ? momentOf(`${date}T${time}`, timezone)
      : undefined
  const errors: Record<string, string> = {
    ...(staffId === '' ? { staffId: '担当スタッフを選んでください。' } : {}),
    ...(isDay(date) ? {} : { date: '来店日を入力してください。' }),
    ...(time === '' ? { startTime: '開始の時刻を入力してください。' } : {}),
    ...(isDay(date) && time !== '' && startTime === undefined
      ? { startTime: NOT_ON_THE_CLOCK }
      : {}),
  }
  if (startTime === undefined || Object.keys(errors).length > 0) {
    return { type: 'invalid', errors }
  }

  return { type: 'valid', request: { staffId, startTime } }
}

/**
 * How long after the first line of a booking the last may begin: a line a
 * day later is a day typed wrong. Every line begins on the day of the
 * visit, so only a day of 25 hours (the end of summer time) holds one
 */
const A_DAY = 24 * 60 * 60 * 1000

const BEYOND_THE_DAY =
  'すべての明細は、最も早い明細の開始から 24 時間以内に始まります。開始の時刻を確かめてください。'

/**
 * The line that is added to a booking, from the form that adds it. It
 * begins on the day of the visit; with the lines the booking has, every
 * line begins within a day of the first, as the API asks.
 */
export const readAddition = (
  values: FormData,
  {
    booking,
    timezone,
  }: {
    booking: Pick<ModelsBookingResponse, 'bookingDate' | 'staffId' | 'services'>
    timezone: string
  },
): Read<ModelsBookingServiceCreateRequest> => {
  const read = readLine(values, (part) => part, {
    date: booking.bookingDate,
    staffId: booking.staffId,
    timezone,
  })
  if (read.type === 'invalid') {
    return read
  }
  const starts = [
    ...booking.services.map(({ startTime }) => Date.parse(startTime)),
    Date.parse(read.request.startTime),
  ]

  return Math.max(...starts) - Math.min(...starts) <= A_DAY
    ? read
    : { type: 'invalid', errors: { startTime: BEYOND_THE_DAY } }
}

/** What came of an attempt to move a booking, with why the API refused it when it did. */
export type MoveAttempt =
  | { type: 'moved'; booking: ModelsBookingResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /** The booking changed meanwhile into a state that is not moved */
  | { type: 'unmovable'; booking: ModelsBookingResponse }
  /** A member is taken: what was found out about each line where it would be */
  | { type: 'taken'; checks: LineCheck[] }
  | { type: 'notFound' }
  | { type: 'forbidden' }
  | { type: 'tooManyRequests' }
  | { type: 'failed' }

/** What came of an attempt to add a line, with why the API refused it when it did. */
export type AdditionAttempt =
  | { type: 'added' }
  | { type: 'invalid'; values: RefusedValue[] }
  /** The booking changed meanwhile: it is finished, or has the most lines */
  | { type: 'unaddable'; booking: ModelsBookingResponse }
  /** The member of the line is taken: what was found out about it */
  | { type: 'taken'; check: LineCheck }
  /** The member is free: the amounts would go beyond what a booking holds */
  | { type: 'tooMuch' }
  | { type: 'notFound' }
  | { type: 'forbidden' }
  | { type: 'tooManyRequests' }
  | { type: 'failed' }

/** What came of an attempt to take a line away. */
export type LineRemovalAttempt =
  | { type: 'deleted' }
  /** The booking changed meanwhile: it is finished, or the line is its last */
  | { type: 'refused'; booking: ModelsBookingResponse }
  /** The booking could not be summed up again without the line */
  | { type: 'unsummed' }
  | { type: 'notFound' }
  | { type: 'forbidden' }
  | { type: 'tooManyRequests' }
  | { type: 'failed' }

const isMoveControl = (field: string): boolean =>
  field === 'staffId' || field === 'startTime'

const LINE_CONTROLS: readonly string[] = [
  'serviceId',
  'staffId',
  'startTime',
  'notes',
]

/** What is said when a member of the staff is taken at a time the booking would have. */
export const MOVE_TAKEN =
  '担当の時間が、ほかの予約と重なっているため、日時と担当を変えられませんでした。動かしたあとの明細ごとに、重なるほかの予約を確かめました。'

/** What is said when the member of the line is taken at its time. */
export const ADDITION_TAKEN =
  '担当の時間が、ほかの予約と重なっているため、施術明細を足せませんでした。足す明細に重なる、ほかの予約を確かめました。'

/** What the form that moves a booking says after the API did not move it. */
export const afterMove = (
  outcome: Exclude<
    MoveAttempt,
    { type: 'moved' } | { type: 'unmovable' } | { type: 'notFound' }
  >,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) =>
      afterRefusal(values, isMoveControl),
    )
    .with({ type: 'taken' }, () => ({ message: MOVE_TAKEN, errors: {} }))
    .with({ type: 'forbidden' }, () => ({
      message: 'このアカウントでは、この予約を変えられません。',
      errors: {},
    }))
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS)
    .with({ type: 'failed' }, () => ({
      message:
        '予約の日時と担当を変えられませんでした。通信の状態を確かめて、もう一度お試しください。',
      errors: {},
    }))
    .exhaustive()

/** What the form that adds a line says after the API did not add it. */
export const afterAddition = (
  outcome: Exclude<
    AdditionAttempt,
    { type: 'added' } | { type: 'unaddable' } | { type: 'notFound' }
  >,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) =>
      afterRefusal(values, (field) => LINE_CONTROLS.includes(field)),
    )
    .with({ type: 'taken' }, () => ({ message: ADDITION_TAKEN, errors: {} }))
    .with({ type: 'tooMuch' }, () => ({
      message:
        '金額の合計が、1 件の予約で扱える上限を超えるため、施術明細を足せませんでした。',
      errors: {},
    }))
    .with({ type: 'forbidden' }, () => ({
      message: 'このアカウントでは、この予約を変えられません。',
      errors: {},
    }))
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS)
    .with({ type: 'failed' }, () => ({
      message:
        '施術明細を足せませんでした。通信の状態を確かめて、もう一度お試しください。',
      errors: {},
    }))
    .exhaustive()

/** What follows an attempt to take a line away. */
export type LineRemovalSays =
  /** The line is gone: the screen leads to the booking */
  | { type: 'done' }
  /** Nothing was done: said in the dialog */
  | { type: 'again'; message: string }
  /** The line stays, and will: the dialog closes, and the page says why from the booking as it is now */
  | { type: 'stays'; booking: ModelsBookingResponse }
  /** The line, or its booking, was gone already: it is read again, and the screen says so */
  | { type: 'gone' }

export const afterLineRemoval = (
  outcome: LineRemovalAttempt,
): LineRemovalSays =>
  match(outcome)
    .returnType<LineRemovalSays>()
    .with({ type: 'deleted' }, () => ({ type: 'done' }))
    .with({ type: 'refused' }, ({ booking }) => ({ type: 'stays', booking }))
    .with({ type: 'unsummed' }, () => ({
      type: 'again',
      message:
        '施術明細を外せませんでした。この明細を外すと、予約の金額を算出し直せません。',
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'again',
      message: 'このアカウントでは、この予約を変えられません。',
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message:
        'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message:
        '施術明細を外せませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()
