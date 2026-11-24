import type {
  ModelsBusinessHours,
  ModelsOpeningHours,
} from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import {
  calendarFrom,
  coordinatesNameOf,
  ratingNameOf,
  taxRateNameOf,
  weekHoursOf,
} from './settings-format'

const open = (
  dayOfWeek: ModelsBusinessHours['dayOfWeek'],
  changes: Partial<ModelsBusinessHours> = {},
): ModelsBusinessHours => ({
  dayOfWeek,
  operatingSlots: [{ startTime: '10:00', endTime: '20:00' }],
  breakSlots: null,
  isClosed: false,
  effectivePeriod: null,
  ...changes,
})

const date = (
  day: string,
  changes: Partial<ModelsOpeningHours> = {},
): ModelsOpeningHours => ({
  dayOfWeek: 'monday',
  date: day,
  openTime: '10:00:00',
  closeTime: '17:00:00',
  isHoliday: false,
  holidayName: null,
  notes: null,
  ...changes,
})

/** What is said of a day the salon does not open on */
const CLOSED = { en: 'Closed', ja: '休業' }
const CLOSED_ALL_DAY = { en: 'Closed all day', ja: '終日休業' }

describe('weekHoursOf', () => {
  it('should name the hours of every day of the week from Monday, a day without an entry closed', () => {
    // Act
    const week = weekHoursOf(
      [
        open('sunday', {
          operatingSlots: [{ startTime: '09:00', endTime: '18:00' }],
        }),
        open('monday', {
          breakSlots: [{ startTime: '13:00', endTime: '14:00' }],
        }),
        open('tuesday', {
          operatingSlots: [
            { startTime: '10:00', endTime: '13:00' },
            { startTime: '15:00', endTime: '20:00' },
          ],
        }),
        open('wednesday', { isClosed: true }),
        open('thursday', { operatingSlots: [] }),
        open('friday', { breakSlots: [] }),
      ],
      'Asia/Tokyo',
    )

    // Assert
    expect(week).toEqual([
      {
        weekday: 'monday',
        hours: {
          en: '10:00–20:00 (break 13:00–14:00)',
          ja: '10:00〜20:00（休憩 13:00〜14:00）',
        },
      },
      {
        weekday: 'tuesday',
        hours: {
          en: '10:00–13:00, 15:00–20:00',
          ja: '10:00〜13:00、15:00〜20:00',
        },
      },
      { weekday: 'wednesday', hours: CLOSED },
      { weekday: 'thursday', hours: CLOSED },
      { weekday: 'friday', hours: { en: '10:00–20:00', ja: '10:00〜20:00' } },
      { weekday: 'saturday', hours: CLOSED },
      { weekday: 'sunday', hours: { en: '09:00–18:00', ja: '09:00〜18:00' } },
    ])
  })

  it('should name the period the hours are kept in by its days at the clock of the salon', () => {
    // Act
    const [monday] = weekHoursOf(
      [
        open('monday', {
          effectivePeriod: {
            startDate: '2026-03-31T15:00:00.000Z',
            endDate: '2026-09-30T14:59:59.000Z',
          },
        }),
      ],
      'Asia/Tokyo',
    )

    // Assert
    expect(monday?.hours).toEqual({
      en: '10:00–20:00, from April 1, 2026 to September 30, 2026',
      ja: '10:00〜20:00・2026年4月1日から2026年9月30日まで',
    })
  })

  it('should close every day of a salon whose week is not set', () => {
    // Assert
    expect(weekHoursOf(null, 'Asia/Tokyo').map(({ hours }) => hours)).toEqual(
      Array.from({ length: 7 }, () => CLOSED),
    )
  })
})

describe('calendarFrom', () => {
  it('should give the dates from today on in their order, with their hours and why the salon is closed', () => {
    // Act
    const calendar = calendarFrom(
      [
        date('2026-11-24', {
          openTime: null,
          closeTime: null,
          isHoliday: true,
          holidayName: '店休日',
          notes: '設備の点検',
        }),
        date('2026-11-20'),
        date('2026-11-23', { isHoliday: true, holidayName: '勤労感謝の日' }),
        date('2026-11-21'),
        date('2026-11-25', {
          openTime: null,
          closeTime: null,
          isHoliday: true,
        }),
      ],
      '2026-11-21',
    )

    // Assert
    expect(calendar).toEqual([
      {
        date: '2026-11-21',
        day: { en: 'Sat, November 21, 2026', ja: '2026年11月21日（土）' },
        hours: { en: '10:00–17:00', ja: '10:00〜17:00' },
        holiday: { en: 'No', ja: 'いいえ' },
        notes: null,
      },
      {
        date: '2026-11-23',
        day: { en: 'Mon, November 23, 2026', ja: '2026年11月23日（月）' },
        hours: { en: '10:00–17:00', ja: '10:00〜17:00' },
        holiday: { en: '勤労感謝の日', ja: '勤労感謝の日' },
        notes: null,
      },
      {
        date: '2026-11-24',
        day: { en: 'Tue, November 24, 2026', ja: '2026年11月24日（火）' },
        hours: CLOSED_ALL_DAY,
        holiday: { en: '店休日', ja: '店休日' },
        notes: '設備の点検',
      },
      {
        date: '2026-11-25',
        day: { en: 'Wed, November 25, 2026', ja: '2026年11月25日（水）' },
        hours: CLOSED_ALL_DAY,
        holiday: { en: 'Holiday or day off', ja: '祝日・休業日' },
        notes: null,
      },
    ])
  })
})

describe('taxRateNameOf', () => {
  it.each<[number, string]>([
    [10, '10%'],
    [8.5, '8.5%'],
    [0, '0%'],
  ])('should name %s as %s', (rate, name) => {
    // Assert
    expect(taxRateNameOf(rate)).toEqual({ en: name, ja: name })
  })
})

describe('coordinatesNameOf', () => {
  it.each<[number | null, number | null, { en: string; ja: string } | null]>([
    [
      35.658,
      139.7016,
      {
        en: 'Latitude 35.658, longitude 139.7016',
        ja: '緯度 35.658、経度 139.7016',
      },
    ],
    [
      35.658,
      null,
      {
        en: 'Latitude 35.658, longitude Not recorded',
        ja: '緯度 35.658、経度 記録なし',
      },
    ],
    [
      -33.85678912,
      151.215,
      {
        en: 'Latitude -33.85678912, longitude 151.215',
        ja: '緯度 -33.85678912、経度 151.215',
      },
    ],
    [null, null, null],
  ])('should name %s and %s as %o', (latitude, longitude, name) => {
    // Assert
    expect(coordinatesNameOf(latitude, longitude)).toEqual(name)
  })
})

describe('ratingNameOf', () => {
  it.each<[number | null, number, { en: string; ja: string }]>([
    [4, 3, { en: '4.0 (3 reviews)', ja: '4.0（3 件のレビュー）' }],
    [4.25, 12, { en: '4.3 (12 reviews)', ja: '4.3（12 件のレビュー）' }],
    [4.5, 1, { en: '4.5 (1 review)', ja: '4.5（1 件のレビュー）' }],
    [null, 0, { en: 'None yet', ja: 'まだありません' }],
  ])('should name %s of %s reviews as %o', (rating, count, name) => {
    // Assert
    expect(ratingNameOf(rating, count)).toEqual(name)
  })
})
