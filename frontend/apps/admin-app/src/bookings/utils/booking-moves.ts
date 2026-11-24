import {
  type RefusedValue,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsBookingRescheduleRequest,
  ModelsBookingResponse,
  ModelsBookingServiceCreateRequest,
  ModelsBookingServiceResponse,
  ModelsBookingStatusType,
} from '@beauty-salon-frontend/api-client'
import { isDay } from '@beauty-salon-frontend/fields'
import { momentOf } from '@beauty-salon-frontend/salon-screens'
import {
  aboutTheAttempt,
  type FormErrors,
  type FormRead,
  type FormSays,
  textOf,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { adminBookingMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import type { LineCheck } from '../api/bookings-api'
import {
  afterRefusal,
  MOST_LINES,
  NOT_ON_THE_CLOCK,
  readLine,
} from './booking-entry'
import { statusNameOf } from './booking-format'

const {
  moves: { move: MOVE, addition: ADDITION, removal: REMOVAL },
  entry: { errors: ERRORS },
} = adminBookingMessages

/** What is wrong with the values of a form of a booking, under the names of its controls */
type Errors = FormErrors<LocalizedText>

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
export const whyUnmovable = (booking: WithStatus): LocalizedText | undefined =>
  isMovable(booking)
    ? undefined
    : MOVE.unmovable(statusNameOf(booking.status), MOVABLE.map(statusNameOf))

/** Why no line is added to a booking, in a sentence; `undefined` when one is. */
export const whyNoLineAdded = (
  booking: WithLines,
): LocalizedText | undefined => {
  if (!UNFINISHED.includes(booking.status)) {
    return ADDITION.closed(
      statusNameOf(booking.status),
      UNFINISHED.map(statusNameOf),
    )
  }

  return booking.services.length < MOST_LINES
    ? undefined
    : ADDITION.full(formats.numberOf(MOST_LINES))
}

/** Why a line stays on a booking, in a sentence; `undefined` when it is taken away. */
export const whyLineStays = (booking: WithLines): LocalizedText | undefined => {
  if (!UNFINISHED.includes(booking.status)) {
    return REMOVAL.closed(statusNameOf(booking.status))
  }

  return booking.services.length > 1 ? undefined : REMOVAL.last
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
): FormRead<ModelsBookingRescheduleRequest, Errors> => {
  const staffId = textOf(values, 'staffId')
  const date = textOf(values, 'date')
  const time = textOf(values, 'startTime')
  const startTime =
    isDay(date) && time !== ''
      ? momentOf(`${date}T${time}`, timezone)
      : undefined
  const errors: Errors = {
    ...(staffId === '' ? { staffId: ERRORS.staff } : {}),
    ...(isDay(date) ? {} : { date: ERRORS.date }),
    ...(time === '' ? { startTime: ERRORS.startTime } : {}),
    ...(isDay(date) && time !== '' && startTime === undefined
      ? { startTime: NOT_ON_THE_CLOCK }
      : {}),
  }
  if (startTime === undefined || Object.keys(errors).length > 0) {
    return { type: 'invalid', errors }
  }

  return { type: 'valid', value: { staffId, startTime } }
}

/**
 * How long after the first line of a booking the last may begin: a line a
 * day later is a day typed wrong. Every line begins on the day of the
 * visit, so only a day of 25 hours (the end of summer time) holds one
 */
const A_DAY = 24 * 60 * 60 * 1000

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
): FormRead<ModelsBookingServiceCreateRequest, Errors> => {
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
    Date.parse(read.value.startTime),
  ]

  return Math.max(...starts) - Math.min(...starts) <= A_DAY
    ? read
    : { type: 'invalid', errors: { startTime: ADDITION.beyondTheDay } }
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

/** What the form that moves a booking says after the API did not move it. */
export const afterMove = (
  outcome: Exclude<
    MoveAttempt,
    { type: 'moved' } | { type: 'unmovable' } | { type: 'notFound' }
  >,
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) =>
      afterRefusal(values, isMoveControl),
    )
    .with({ type: 'taken' }, () => aboutTheAttempt(MOVE.taken))
    .with({ type: 'forbidden' }, () => aboutTheAttempt(MOVE.forbidden))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(MOVE.failed))
    .exhaustive()

/** What the form that adds a line says after the API did not add it. */
export const afterAddition = (
  outcome: Exclude<
    AdditionAttempt,
    { type: 'added' } | { type: 'unaddable' } | { type: 'notFound' }
  >,
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) =>
      afterRefusal(values, (field) => LINE_CONTROLS.includes(field)),
    )
    .with({ type: 'taken' }, () => aboutTheAttempt(ADDITION.taken))
    .with({ type: 'tooMuch' }, () => aboutTheAttempt(ADDITION.tooMuch))
    .with({ type: 'forbidden' }, () => aboutTheAttempt(ADDITION.forbidden))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(ADDITION.failed))
    .exhaustive()

/** What follows an attempt to take a line away. */
export type LineRemovalSays =
  /** The line is gone: the screen leads to the booking */
  | { type: 'done' }
  /** Nothing was done: said in the dialog */
  | { type: 'again'; message: LocalizedText }
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
      message: REMOVAL.unsummed,
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'again',
      message: REMOVAL.forbidden,
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: REMOVAL.failed,
    }))
    .exhaustive()
