import {
  NOT_SENT_MESSAGE,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsBookingCancelRequest,
  ModelsBookingRescheduleRequest,
  ModelsCustomerBookingCreateRequest,
} from '@beauty-salon-frontend/api-client'
import {
  aboutTheAttempt,
  type FormRead,
  type FormSays,
  textOf,
} from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import type { Booking, Cancellation, Move } from '../api/bookings-api'
import type { Time } from './booking-choice'
/** What is booked, as the address of the screen and its choices say it. */
export type Asked = {
  salonId: string
  serviceId: string
  /** `undefined`: with whoever is free */
  staffId: string | undefined
  /** The times the screen offers */
  times: readonly Time[]
}

/**
 * The booking the form was sent for. The time is one of those on offer; a
 * customer who asked for nobody in particular gets the first member of the
 * staff who is free then. A request without a word is no request.
 */
export const readBooking = (
  values: FormData,
  { salonId, serviceId, staffId, times }: Asked,
): FormRead<ModelsCustomerBookingCreateRequest> => {
  const time = times.find(
    ({ startTime }) => startTime === textOf(values, 'startTime'),
  )
  const withWhom = staffId ?? time?.staffIds.at(0)
  const customerRequest = textOf(values, 'customerRequest').trim()

  return time === undefined || withWhom === undefined
    ? {
        type: 'invalid',
        errors: { startTime: '開始時刻を選択してください。' },
      }
    : {
        type: 'valid',
        value: {
          salonId,
          serviceId,
          staffId: withWhom,
          startTime: time.startTime,
          customerRequest: customerRequest === '' ? null : customerRequest,
        },
      }
}

/**
 * What the form says after the API did not take the booking. A refusal does
 * not say why, and neither does the form: the times are read again, and the
 * customer chooses among those that are left.
 */
export const afterBooking = (
  outcome: Exclude<Booking, { type: 'booked' }>,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'refused' }, () =>
      aboutTheAttempt(
        'この日時では、予約できませんでした。空いている時刻を読み込み直しましたので、選び直してください。予約できない状態が続くときは、サロンにお問い合わせください。',
      ),
    )
    .with({ type: 'noProfile' }, () =>
      aboutTheAttempt(
        'お客様の情報を読み込めませんでした。もう一度、お客様の情報を登録してください。',
      ),
    )
    .with({ type: 'invalid' }, () =>
      aboutTheAttempt(
        '予約できませんでした。ページを読み込み直して、もう一度お試しください。',
      ),
    )
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(NOT_SENT_MESSAGE))
    .exhaustive()

/**
 * What the dialog that cancels a booking was sent with. The reason is the
 * customer's to give or not: one without a word is none.
 */
export const readCancellation = (
  values: FormData,
): ModelsBookingCancelRequest => {
  const reason = textOf(values, 'cancellationReason').trim()

  return { cancellationReason: reason === '' ? null : reason }
}

/** What is said after the API did not cancel a booking, and where. */
export type CancellationSays =
  /** In the dialog, which stays open: the customer may try again */
  | { type: 'again'; message: string }
  /**
   * On the page, and the dialog closes: the booking is read again, and may
   * no longer be one that can be cancelled
   */
  | { type: 'refused'; message: string }
  /** Nothing: the page reads the booking again, and says that there is none */
  | { type: 'gone' }

/**
 * What follows when the API did not cancel a booking. A refusal does not
 * say why: the salon changed the state of the booking in the meantime, or
 * its time has come.
 */
export const afterCancellation = (
  outcome: Exclude<Cancellation, { type: 'cancelled' }>,
): CancellationSays =>
  match(outcome)
    .returnType<CancellationSays>()
    .with({ type: 'refused' }, () => ({
      type: 'refused',
      message:
        'この予約は、キャンセルできませんでした。サロンが予約の状態を変えたか、開始時刻を過ぎています。予約の内容を読み込み直しましたので、お確かめください。',
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: NOT_SENT_MESSAGE,
    }))
    .exhaustive()

/** Where a booking is moved to, as the screen and its choices say it. */
export type AskedToMove = {
  /** `undefined`: with whoever is free */
  staffId: string | undefined
  /** The times the screen offers */
  times: readonly Time[]
}

/**
 * The move the form was sent for. The time is one of those on offer; a
 * customer who asked for nobody in particular gets the first member of the
 * staff who is free then.
 */
export const readMove = (
  values: FormData,
  { staffId, times }: AskedToMove,
): FormRead<ModelsBookingRescheduleRequest> => {
  const time = times.find(
    ({ startTime }) => startTime === textOf(values, 'startTime'),
  )
  const withWhom = staffId ?? time?.staffIds.at(0)

  return time === undefined || withWhom === undefined
    ? {
        type: 'invalid',
        errors: { startTime: '開始時刻を選択してください。' },
      }
    : {
        type: 'valid',
        value: { startTime: time.startTime, staffId: withWhom },
      }
}

/**
 * What the form says after the API did not move the booking. A refusal
 * does not say why: the time was taken in the meantime, the booking can no
 * longer be changed, or it is one that the salon has to move. The times
 * are read again, and the customer is told whom to ask.
 */
export const afterMove = (
  outcome: Exclude<Move, { type: 'moved' }>,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'refused' }, () =>
      aboutTheAttempt(
        'この日時には、変更できませんでした。空いている時刻を読み込み直しましたので、選び直してください。変更できない状態が続くときは、サロンにお問い合わせください。',
      ),
    )
    .with({ type: 'notFound' }, () =>
      aboutTheAttempt(
        'この予約は、見つかりませんでした。予約の一覧から、お確かめください。',
      ),
    )
    .with({ type: 'invalid' }, () =>
      aboutTheAttempt(
        '変更できませんでした。ページを読み込み直して、もう一度お試しください。',
      ),
    )
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(NOT_SENT_MESSAGE))
    .exhaustive()
