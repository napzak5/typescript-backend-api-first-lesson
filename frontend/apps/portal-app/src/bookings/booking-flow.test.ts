import { formOf } from '@beauty-salon-frontend/testing/forms'
import { describe, expect, it } from 'vitest'
import type { Time } from './booking-choice'
import {
  type Asked,
  afterBooking,
  afterCancellation,
  afterMove,
  readBooking,
  readCancellation,
  readMove,
} from './booking-flow'

const SALON_ID = '0b7f5c1e-3a52-4d8e-9c41-6f2e8d1a7b90'
const SERVICE_ID = '1a3c5e7f-9b20-4d46-8e68-0a2c4e6f8b79'
const FIRST = '6f81a3c4-e075-429b-93bd-5f7193acc0ce'
const SECOND = '7092b4d5-f186-43ac-a4ce-60829bbdd1df'

const TEN = '2026-11-24T01:00:00.000Z'
const HALF_PAST_TEN = '2026-11-24T01:30:00.000Z'

/** At 10:00 the second member of the staff is free alone; at 10:30 both are. */
const TIMES: Time[] = [
  { startTime: TEN, label: '10:00', staffIds: [SECOND] },
  { startTime: HALF_PAST_TEN, label: '10:30', staffIds: [FIRST, SECOND] },
]

const ASKED: Asked = {
  salonId: SALON_ID,
  serviceId: SERVICE_ID,
  staffId: undefined,
  times: TIMES,
}

describe('readBooking', () => {
  it('should book the time that was chosen, at the salon and for the service of the screen', () => {
    expect(
      readBooking(formOf({ startTime: TEN, customerRequest: '' }), ASKED),
    ).toEqual({
      type: 'valid',
      value: {
        salonId: SALON_ID,
        serviceId: SERVICE_ID,
        staffId: SECOND,
        startTime: TEN,
        customerRequest: null,
      },
    })
  })

  it('should book with the first member of the staff who is free then, when nobody in particular was asked for', () => {
    expect(
      readBooking(formOf({ startTime: HALF_PAST_TEN }), ASKED),
    ).toMatchObject({ value: { staffId: FIRST, startTime: HALF_PAST_TEN } })
  })

  it('should book with the member of the staff who was asked for', () => {
    expect(
      readBooking(formOf({ startTime: HALF_PAST_TEN }), {
        ...ASKED,
        staffId: SECOND,
      }),
    ).toMatchObject({ value: { staffId: SECOND } })
  })

  it('should pass on what was written for the salon, without the spaces around it', () => {
    expect(
      readBooking(
        formOf({
          startTime: TEN,
          customerRequest: '  前髪は短めに。\nカラーの相談もしたいです。 \n',
        }),
        ASKED,
      ),
    ).toMatchObject({
      value: { customerRequest: '前髪は短めに。\nカラーの相談もしたいです。' },
    })
  })

  it.each([
    ['nothing was written', ''],
    ['spaces alone were written', ' \n　\t'],
  ])('should book without a request when %s', (_case, customerRequest) => {
    expect(
      readBooking(formOf({ startTime: TEN, customerRequest }), ASKED),
    ).toMatchObject({ value: { customerRequest: null } })
  })

  it('should book without a request when the form has no such control', () => {
    expect(readBooking(formOf({ startTime: TEN }), ASKED)).toMatchObject({
      value: { customerRequest: null },
    })
  })

  it.each([
    ['no time was chosen', {}],
    ['the time is none', { startTime: '' }],
    [
      'the time is not among those on offer',
      { startTime: '2026-11-24T02:00:00.000Z' },
    ],
    ['the time is a time of day and no moment', { startTime: '10:00' }],
    ['the time is no text', { startTime: new Blob(['10:00']) }],
  ])('should ask for a time, and book nothing, when %s', (_case, values) => {
    expect(readBooking(formOf(values), ASKED)).toEqual({
      type: 'invalid',
      errors: { startTime: '開始時刻を選択してください。' },
    })
  })

  it('should ask for a time when the day has none', () => {
    expect(
      readBooking(formOf({ startTime: TEN }), { ...ASKED, times: [] }),
    ).toMatchObject({ type: 'invalid' })
  })
})

describe('afterBooking', () => {
  it('should say that the time could not be booked, without saying why, and that the times were read again', () => {
    expect(afterBooking({ type: 'refused' })).toEqual({
      message:
        'この日時では、予約できませんでした。空いている時刻を読み込み直しましたので、選び直してください。予約できない状態が続くときは、サロンにお問い合わせください。',
      errors: {},
    })
  })

  it('should ask for the profile again when the account has none any more', () => {
    expect(afterBooking({ type: 'noProfile' })).toEqual({
      message:
        'お客様の情報を読み込めませんでした。もう一度、お客様の情報を登録してください。',
      errors: {},
    })
  })

  it('should ask to load the page again when what was chosen is there no longer', () => {
    expect(afterBooking({ type: 'invalid' })).toEqual({
      message:
        '予約できませんでした。ページを読み込み直して、もう一度お試しください。',
      errors: {},
    })
  })

  it('should ask to wait after too many requests', () => {
    expect(afterBooking({ type: 'tooManyRequests' })).toEqual({
      message:
        'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      errors: {},
    })
  })

  it('should say that nothing was sent when there was no answer to act on', () => {
    expect(afterBooking({ type: 'failed' })).toEqual({
      message:
        '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
      errors: {},
    })
  })
})

describe('readCancellation', () => {
  it('should send the reason that was written', () => {
    expect(
      readCancellation(formOf({ cancellationReason: '都合が悪くなりました' })),
    ).toEqual({ cancellationReason: '都合が悪くなりました' })
  })

  it('should send the reason without the space around it, and with the lines it was written in', () => {
    expect(
      readCancellation(
        formOf({
          cancellationReason: '  体調がすぐれません。\n\nまた予約します。\n',
        }),
      ),
    ).toEqual({
      cancellationReason: '体調がすぐれません。\n\nまた予約します。',
    })
  })

  it.each([
    ['nothing was written', { cancellationReason: '' }],
    ['space alone was written', { cancellationReason: ' \n　 ' }],
    ['the dialog has no such control', {}],
    ['the value is a file', { cancellationReason: new Blob(['理由']) }],
  ])('should send that there is no reason when %s', (_case, values) => {
    expect(readCancellation(formOf(values))).toEqual({
      cancellationReason: null,
    })
  })
})

describe('afterCancellation', () => {
  it('should say on the page that the booking could not be cancelled, without a reason the API does not give', () => {
    expect(afterCancellation({ type: 'refused' })).toEqual({
      type: 'refused',
      message:
        'この予約は、キャンセルできませんでした。サロンが予約の状態を変えたか、開始時刻を過ぎています。予約の内容を読み込み直しましたので、お確かめください。',
    })
  })

  it('should say nothing of a booking that is no longer there: the page says it', () => {
    expect(afterCancellation({ type: 'notFound' })).toEqual({ type: 'gone' })
  })

  it('should ask in the dialog to wait after too many requests', () => {
    expect(afterCancellation({ type: 'tooManyRequests' })).toEqual({
      type: 'again',
      message:
        'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    })
  })

  it('should say in the dialog that nothing was sent when there was no answer to act on', () => {
    expect(afterCancellation({ type: 'failed' })).toEqual({
      type: 'again',
      message:
        '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
    })
  })
})

describe('readMove', () => {
  const TO_MOVE = { staffId: undefined, times: TIMES }

  it('should move the booking to the time that was chosen, with the member of the staff who was asked for', () => {
    expect(
      readMove(formOf({ startTime: HALF_PAST_TEN }), {
        ...TO_MOVE,
        staffId: FIRST,
      }),
    ).toEqual({
      type: 'valid',
      value: { startTime: HALF_PAST_TEN, staffId: FIRST },
    })
  })

  it('should give a customer who asked for nobody the first member of the staff who is free then', () => {
    expect(readMove(formOf({ startTime: HALF_PAST_TEN }), TO_MOVE)).toEqual({
      type: 'valid',
      value: { startTime: HALF_PAST_TEN, staffId: FIRST },
    })
    expect(readMove(formOf({ startTime: TEN }), TO_MOVE)).toEqual({
      type: 'valid',
      value: { startTime: TEN, staffId: SECOND },
    })
  })

  it.each([
    ['no time was chosen', {}],
    [
      'the time is none of those on offer',
      { startTime: '2026-11-24T02:00:00.000Z' },
    ],
    ['the time is empty', { startTime: '' }],
    ['the value is a file', { startTime: new Blob([TEN]) }],
  ])('should ask for a time when %s', (_case, values) => {
    expect(readMove(formOf(values), TO_MOVE)).toEqual({
      type: 'invalid',
      errors: { startTime: '開始時刻を選択してください。' },
    })
  })

  it('should ask for a time when the time that was chosen has nobody who is free', () => {
    expect(
      readMove(formOf({ startTime: TEN }), {
        staffId: undefined,
        times: [{ startTime: TEN, label: '10:00', staffIds: [] }],
      }),
    ).toEqual({
      type: 'invalid',
      errors: { startTime: '開始時刻を選択してください。' },
    })
  })

  it('should send nothing but the time and the member of the staff, whatever else the form holds', () => {
    expect(
      readMove(
        formOf({ startTime: TEN, customerRequest: '静かな席を希望します' }),
        TO_MOVE,
      ),
    ).toEqual({ type: 'valid', value: { startTime: TEN, staffId: SECOND } })
  })
})

describe('afterMove', () => {
  it('should say that the booking could not be moved there and that the times were read again, without a reason the API does not give, and whom to ask', () => {
    expect(afterMove({ type: 'refused' })).toEqual({
      message:
        'この日時には、変更できませんでした。空いている時刻を読み込み直しましたので、選び直してください。変更できない状態が続くときは、サロンにお問い合わせください。',
      errors: {},
    })
  })

  it('should say that the booking is no longer there', () => {
    expect(afterMove({ type: 'notFound' })).toEqual({
      message:
        'この予約は、見つかりませんでした。予約の一覧から、お確かめください。',
      errors: {},
    })
  })

  it('should ask to load the page again when what was chosen is there no longer', () => {
    expect(afterMove({ type: 'invalid' })).toEqual({
      message:
        '変更できませんでした。ページを読み込み直して、もう一度お試しください。',
      errors: {},
    })
  })

  it('should ask to wait after too many requests', () => {
    expect(afterMove({ type: 'tooManyRequests' })).toEqual({
      message:
        'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      errors: {},
    })
  })

  it('should say that nothing was sent when there was no answer to act on', () => {
    expect(afterMove({ type: 'failed' })).toEqual({
      message:
        '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
      errors: {},
    })
  })
})
