import type { ModelsCustomerBookingCreateRequest } from '@beauty-salon-frontend/api-client'
import { match } from 'ts-pattern'
import type { FormSays, Read } from '../forms'
import type { Time } from './booking-choice'
import type { Booking } from './bookings-api'

const textOf = (values: FormData, name: string): string => {
  const value = values.get(name)

  return typeof value === 'string' ? value : ''
}

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
): Read<ModelsCustomerBookingCreateRequest> => {
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
    .with({ type: 'refused' }, () => ({
      message:
        'この日時では、予約できませんでした。空いている時刻を読み込み直しましたので、選び直してください。予約できない状態が続くときは、サロンにお問い合わせください。',
      errors: {},
    }))
    .with({ type: 'noProfile' }, () => ({
      message:
        'お客様の情報を読み込めませんでした。もう一度、お客様の情報を登録してください。',
      errors: {},
    }))
    .with({ type: 'invalid' }, () => ({
      message:
        '予約できませんでした。ページを読み込み直して、もう一度お試しください。',
      errors: {},
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      message:
        'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      errors: {},
    }))
    .with({ type: 'failed' }, () => ({
      message:
        '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
      errors: {},
    }))
    .exhaustive()
