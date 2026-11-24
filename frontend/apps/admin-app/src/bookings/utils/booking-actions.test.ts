import type { ModelsBookingStatusType } from '@beauty-salon-frontend/api-client'
import { formOfEntries } from '@beauty-salon-frontend/testing/forms'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import type { StatusChange } from '../api/bookings-api'
import { aBooking } from '../components/examples'
import {
  actionsOf,
  afterChange,
  CHANGED_ELSEWHERE,
  type ChangeSays,
  readCancellation,
  readCompletion,
  type StatusAction,
} from './booking-actions'

const START = '2026-11-20T01:00:00.000Z'
const BEFORE = new Date('2026-11-20T00:59:59.999Z')
const AT = new Date(START)

const ACTIONS: [ModelsBookingStatusType, Date, StatusAction[]][] = [
  ['draft', BEFORE, ['confirm', 'cancel']],
  ['pending', BEFORE, ['confirm', 'cancel']],
  ['pending', AT, ['confirm', 'noShow', 'cancel']],
  ['confirmed', BEFORE, ['start', 'complete', 'cancel']],
  ['confirmed', AT, ['start', 'complete', 'noShow', 'cancel']],
  ['in_progress', AT, ['complete']],
  ['completed', AT, []],
  ['cancelled', AT, []],
  ['no_show', AT, []],
]

describe('actionsOf', () => {
  it.each(ACTIONS)(
    'should offer for a booking that is %s, at %s, what the API takes',
    (status, now, actions) => {
      expect(actionsOf({ status, startTime: START }, now)).toEqual(actions)
    },
  )
})

const TOKYO = { timezone: 'Asia/Tokyo', recordedStart: null }

describe('readCompletion', () => {
  it('should read both times on the clock of the salon', () => {
    expect(
      readCompletion(
        formOfEntries([
          ['actualStartTime', '2026-11-20T10:05'],
          ['actualEndTime', '2026-11-20T11:10'],
        ]),
        TOKYO,
      ),
    ).toEqual({
      type: 'valid',
      value: {
        actualStartTime: '2026-11-20T01:05:00.000Z',
        actualEndTime: '2026-11-20T02:10:00.000Z',
      },
    })
  })

  it('should keep what was recorded for what was left empty', () => {
    expect(
      readCompletion(
        formOfEntries([
          ['actualStartTime', ''],
          ['actualEndTime', ' '],
        ]),
        TOKYO,
      ),
    ).toEqual({
      type: 'valid',
      value: { actualStartTime: null, actualEndTime: null },
    })
  })

  it('should take an end after the beginning that was recorded', () => {
    expect(
      readCompletion(formOfEntries([['actualEndTime', '2026-11-20T11:00']]), {
        timezone: 'Asia/Tokyo',
        recordedStart: '2026-11-20T01:05:00.000Z',
      }),
    ).toEqual({
      type: 'valid',
      value: {
        actualStartTime: null,
        actualEndTime: '2026-11-20T02:00:00.000Z',
      },
    })
  })

  it('should refuse an end that is not after the beginning that was filled in', () => {
    expect(
      readCompletion(
        formOfEntries([
          ['actualStartTime', '2026-11-20T10:05'],
          ['actualEndTime', '2026-11-20T10:05'],
        ]),
        TOKYO,
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        actualEndTime: {
          en: 'Make the end later than the start.',
          ja: '終了は、開始より後の時刻にしてください。',
        },
      },
    })
  })

  it('should refuse an end that is not after the beginning that was recorded', () => {
    expect(
      readCompletion(formOfEntries([['actualEndTime', '2026-11-20T10:00']]), {
        timezone: 'Asia/Tokyo',
        recordedStart: '2026-11-20T01:05:00.000Z',
      }),
    ).toEqual({
      type: 'invalid',
      errors: {
        actualEndTime: {
          en: 'Make the end later than the recorded start.',
          ja: '終了は、記録した開始より後の時刻にしてください。',
        },
      },
    })
  })

  it('should let a beginning that was filled in replace the one recorded', () => {
    expect(
      readCompletion(
        formOfEntries([
          ['actualStartTime', '2026-11-20T09:55'],
          ['actualEndTime', '2026-11-20T10:00'],
        ]),
        {
          timezone: 'Asia/Tokyo',
          recordedStart: '2026-11-20T01:05:00.000Z',
        },
      ).type,
    ).toBe('valid')
  })

  it.each([
    [
      'a time the clock of the salon skips',
      '2026-03-08T02:30',
      'America/New_York',
    ],
    ['what is no time', 'tomorrow', 'Asia/Tokyo'],
    ['a day the API does not take', '1899-12-31T10:00', 'Asia/Tokyo'],
  ])('should refuse %s in either field', (_case, local, timezone) => {
    expect(
      readCompletion(
        formOfEntries([
          ['actualStartTime', local],
          ['actualEndTime', local],
        ]),
        { timezone, recordedStart: null },
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        actualStartTime: {
          en: 'Enter a date and a time. On some days the clock of the salon skips a time (daylight saving time begins).',
          ja: '日付と時刻を入力してください。サロンの時計で、その時刻がない日（夏時間の始まり）もあります。',
        },
        actualEndTime: {
          en: 'Enter a date and a time. On some days the clock of the salon skips a time (daylight saving time begins).',
          ja: '日付と時刻を入力してください。サロンの時計で、その時刻がない日（夏時間の始まり）もあります。',
        },
      },
    })
  })
})

const NO_REASON: [string, [string, string][]][] = [
  ['an empty reason', [['cancellationReason', '']]],
  ['a reason of blanks', [['cancellationReason', ' \n ']]],
  ['no field', []],
]

describe('readCancellation', () => {
  it('should read the reason without the blanks around it', () => {
    expect(
      readCancellation(
        formOfEntries([['cancellationReason', ' 体調不良のため ']]),
      ),
    ).toEqual({ cancellationReason: '体調不良のため' })
  })

  it.each(NO_REASON)('should record no reason for %s', (_case, entries) => {
    expect(readCancellation(formOfEntries(entries))).toEqual({
      cancellationReason: null,
    })
  })
})

const DONE: [StatusAction, LocalizedText][] = [
  ['confirm', { en: 'Confirmed the booking.', ja: '予約を確定しました。' }],
  [
    'start',
    {
      en: 'Recorded the start of the treatment.',
      ja: '施術の開始を記録しました。',
    },
  ],
  ['complete', { en: 'Completed the booking.', ja: '予約を完了にしました。' }],
  [
    'cancel',
    { en: 'Cancelled the booking.', ja: '予約をキャンセルしました。' },
  ],
  [
    'noShow',
    { en: 'Recorded a no-show.', ja: '無断キャンセルを記録しました。' },
  ],
]

const NOT_DONE: [string, StatusChange, ChangeSays<LocalizedText>][] = [
  [
    'a booking that changed elsewhere',
    { type: 'conflict' },
    { type: 'changed', message: CHANGED_ELSEWHERE },
  ],
  ['a booking that is not there', { type: 'notFound' }, { type: 'gone' }],
  ['a booking of another salon', { type: 'forbidden' }, { type: 'gone' }],
  [
    'too many requests',
    { type: 'tooManyRequests' },
    {
      type: 'again',
      message: {
        en: 'There are too many requests. Wait a while and try again.',
        ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    },
  ],
  [
    'a failure',
    { type: 'failed' },
    {
      type: 'again',
      message: {
        en: 'The booking could not be cancelled. Check your connection and try again.',
        ja: '予約をキャンセルできませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    },
  ],
]

describe('afterChange', () => {
  it.each(DONE)('should say that %s was done', (action, message) => {
    expect(
      afterChange({ type: 'changed', booking: aBooking() }, action),
    ).toEqual({ type: 'done', message })
  })

  it.each(NOT_DONE)('should say what follows %s', (_case, outcome, says) => {
    expect(afterChange(outcome, 'cancel')).toEqual(says)
  })
})
