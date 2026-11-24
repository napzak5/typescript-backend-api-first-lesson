import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type {
  ModelsBookingCancelRequest,
  ModelsBookingCompleteRequest,
  ModelsBookingResponse,
  ModelsBookingStatusType,
} from '@beauty-salon-frontend/api-client'
import { isDay } from '@beauty-salon-frontend/fields'
import { momentOf } from '@beauty-salon-frontend/salon-screens'
import {
  type FormErrors,
  type FormRead,
  textOf,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminBookingMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import type { StatusChange } from '../api/bookings-api'

const { status: STATUS } = adminBookingMessages.details
const { completion: COMPLETION } = STATUS

/** What can be done to the state of a booking. */
export type StatusAction =
  | 'confirm'
  | 'start'
  | 'complete'
  | 'cancel'
  | 'noShow'

/**
 * The operations each state leads on to, in the order the buttons stand.
 * A booking that was completed, cancelled or nobody came to stays so.
 */
const ACTIONS: Record<ModelsBookingStatusType, readonly StatusAction[]> = {
  draft: ['confirm', 'cancel'],
  pending: ['confirm', 'noShow', 'cancel'],
  confirmed: ['start', 'complete', 'noShow', 'cancel'],
  in_progress: ['complete'],
  completed: [],
  cancelled: [],
  no_show: [],
}

/**
 * The operations that can be done to a booking now. That nobody came is
 * recorded once its time has come, and not before: the API refuses it.
 */
export const actionsOf = (
  { status, startTime }: Pick<ModelsBookingResponse, 'status' | 'startTime'>,
  now: Date,
): StatusAction[] =>
  ACTIONS[status].filter(
    (action) =>
      action !== 'noShow' || now.getTime() >= new Date(startTime).getTime(),
  )

/** The moment of a field, if it is one, on a day the API takes. */
const momentIn = (local: string, timezone: string): string | undefined => {
  const moment = momentOf(local, timezone)

  return moment !== undefined && isDay(moment.slice(0, 10)) ? moment : undefined
}

/**
 * The completion of a booking, from its form: when it actually began and
 * ended, on the clock of the salon, each of them if it was filled in. What
 * is left empty keeps what was recorded. The end comes after the
 * beginning: the one filled in, or the one recorded when the treatment
 * began.
 */
export const readCompletion = (
  values: FormData,
  {
    timezone,
    recordedStart,
  }: { timezone: string; recordedStart: string | null },
): FormRead<ModelsBookingCompleteRequest, FormErrors<LocalizedText>> => {
  const start = textOf(values, 'actualStartTime').trim()
  const end = textOf(values, 'actualEndTime').trim()
  const actualStartTime = start === '' ? null : momentIn(start, timezone)
  const actualEndTime = end === '' ? null : momentIn(end, timezone)
  const errors: FormErrors<LocalizedText> = {
    ...(actualStartTime === undefined
      ? { actualStartTime: COMPLETION.notAMoment }
      : {}),
    ...(actualEndTime === undefined
      ? { actualEndTime: COMPLETION.notAMoment }
      : {}),
  }
  if (actualStartTime === undefined || actualEndTime === undefined) {
    return { type: 'invalid', errors }
  }
  const beginning = actualStartTime ?? recordedStart
  if (
    actualEndTime !== null &&
    beginning !== null &&
    new Date(actualEndTime).getTime() <= new Date(beginning).getTime()
  ) {
    return {
      type: 'invalid',
      errors: {
        actualEndTime:
          actualStartTime === null
            ? COMPLETION.endAfterRecordedStart
            : COMPLETION.endAfterStart,
      },
    }
  }

  return { type: 'valid', value: { actualStartTime, actualEndTime } }
}

/** The cancellation of a booking, from its form: the reason, if one was given. */
export const readCancellation = (
  values: FormData,
): ModelsBookingCancelRequest => {
  const reason = textOf(values, 'cancellationReason').trim()

  return { cancellationReason: reason === '' ? null : reason }
}

/** What is said when the booking changed elsewhere in the meantime. */
export const CHANGED_ELSEWHERE = STATUS.changedElsewhere

/**
 * What follows an operation on the state of a booking, or of another
 * record that goes from state to state: a purchase order.
 */
export type ChangeSays =
  /** The booking is in its new state: a notification says so */
  | { type: 'done'; message: LocalizedText }
  /** Nothing was done, and nothing is known to have changed: try again */
  | { type: 'again'; message: LocalizedText }
  /**
   * The booking changed elsewhere: it is read again, and the screen says
   * so where its state is
   */
  | { type: 'changed'; message: LocalizedText }
  /** The booking is gone, or out of reach: it is read again, and the screen says so */
  | { type: 'gone' }

export const afterChange = (
  outcome: StatusChange,
  action: StatusAction,
): ChangeSays =>
  match(outcome)
    .returnType<ChangeSays>()
    .with({ type: 'changed' }, () => ({
      type: 'done',
      message: STATUS.done[action],
    }))
    .with({ type: 'conflict' }, () => ({
      type: 'changed',
      message: CHANGED_ELSEWHERE,
    }))
    .with({ type: 'notFound' }, { type: 'forbidden' }, () => ({ type: 'gone' }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: STATUS.failed[action],
    }))
    .exhaustive()
