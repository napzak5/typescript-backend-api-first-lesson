import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type {
  ModelsBookingCancelRequest,
  ModelsBookingCompleteRequest,
  ModelsBookingResponse,
  ModelsBookingStatusType,
} from '@beauty-salon-frontend/api-client'
import { isDay, momentOf } from '@beauty-salon-frontend/salon-screens'
import { type FormRead, textOf } from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import type { StatusChange } from './bookings-api'

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

const NOT_A_MOMENT =
  '日付と時刻を入力してください。サロンの時計で、その時刻がない日（夏時間の始まり）もあります。'

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
): FormRead<ModelsBookingCompleteRequest> => {
  const start = textOf(values, 'actualStartTime').trim()
  const end = textOf(values, 'actualEndTime').trim()
  const actualStartTime = start === '' ? null : momentIn(start, timezone)
  const actualEndTime = end === '' ? null : momentIn(end, timezone)
  const errors: Record<string, string> = {
    ...(actualStartTime === undefined ? { actualStartTime: NOT_A_MOMENT } : {}),
    ...(actualEndTime === undefined ? { actualEndTime: NOT_A_MOMENT } : {}),
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
            ? '終了は、記録した開始より後の時刻にしてください。'
            : '終了は、開始より後の時刻にしてください。',
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

/** What an operation does, as a sentence says it was done or not */
const DONE: Record<StatusAction, string> = {
  confirm: '予約を確定',
  start: '施術の開始を記録',
  complete: '予約を完了に',
  cancel: '予約をキャンセル',
  noShow: '無断キャンセルを記録',
}

/** What is said when the booking changed elsewhere in the meantime. */
export const CHANGED_ELSEWHERE =
  '予約の状態が、ほかの画面か端末で変わっていました。いまの状態を読み込み直しました。'

/** What follows an operation on the state of a booking. */
export type ChangeSays =
  /** The booking is in its new state: a notification says so */
  | { type: 'done'; message: string }
  /** Nothing was done, and nothing is known to have changed: try again */
  | { type: 'again'; message: string }
  /**
   * The booking changed elsewhere: it is read again, and the screen says
   * so where its state is
   */
  | { type: 'changed'; message: string }
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
      message: `${DONE[action]}しました。`,
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
      message: `${DONE[action]}できませんでした。通信の状態を確かめて、もう一度お試しください。`,
    }))
    .exhaustive()
