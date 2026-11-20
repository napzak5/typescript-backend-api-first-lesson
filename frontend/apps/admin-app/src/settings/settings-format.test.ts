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
        open('wednesday', { isClosed: true, operatingSlots: [] }),
        open('thursday', { operatingSlots: [] }),
        open('friday', { breakSlots: [] }),
      ],
      'Asia/Tokyo',
    )

    // Assert
    expect(week).toEqual([
      { weekday: 'monday', hours: '10:00〜20:00（休憩 13:00〜14:00）' },
      { weekday: 'tuesday', hours: '10:00〜13:00、15:00〜20:00' },
      { weekday: 'wednesday', hours: '休業' },
      { weekday: 'thursday', hours: '休業' },
      { weekday: 'friday', hours: '10:00〜20:00' },
      { weekday: 'saturday', hours: '休業' },
      { weekday: 'sunday', hours: '09:00〜18:00' },
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
    expect(monday?.hours).toBe(
      '10:00〜20:00・2026年4月1日から2026年9月30日まで',
    )
  })

  it('should close every day of a salon whose week is not set', () => {
    expect(weekHoursOf(null, 'Asia/Tokyo').map(({ hours }) => hours)).toEqual([
      '休業',
      '休業',
      '休業',
      '休業',
      '休業',
      '休業',
      '休業',
    ])
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
        day: '2026年11月21日（土）',
        hours: '10:00〜17:00',
        holiday: 'いいえ',
        notes: '記録なし',
      },
      {
        date: '2026-11-23',
        day: '2026年11月23日（月）',
        hours: '10:00〜17:00',
        holiday: '勤労感謝の日',
        notes: '記録なし',
      },
      {
        date: '2026-11-24',
        day: '2026年11月24日（火）',
        hours: '終日休業',
        holiday: '店休日',
        notes: '設備の点検',
      },
      {
        date: '2026-11-25',
        day: '2026年11月25日（水）',
        hours: '終日休業',
        holiday: '祝日・休業日',
        notes: '記録なし',
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
    expect(taxRateNameOf(rate)).toBe(name)
  })
})

describe('coordinatesNameOf', () => {
  it.each<[number | null, number | null, string]>([
    [35.658, 139.7016, '緯度 35.658、経度 139.7016'],
    [35.658, null, '緯度 35.658、経度 記録なし'],
    [null, null, '記録なし'],
  ])('should name %s and %s as %s', (latitude, longitude, name) => {
    expect(coordinatesNameOf(latitude, longitude)).toBe(name)
  })
})

describe('ratingNameOf', () => {
  it.each<[number | null, number, string]>([
    [4, 3, '4.0（3 件のレビュー）'],
    [4.25, 12, '4.3（12 件のレビュー）'],
    [null, 0, 'まだありません'],
  ])('should name %s of %s reviews as %s', (rating, count, name) => {
    expect(ratingNameOf(rating, count)).toBe(name)
  })
})
