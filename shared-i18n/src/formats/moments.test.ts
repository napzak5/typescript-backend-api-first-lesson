import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../languages/localized-text'
import { momentAt, timeOfDayAt } from './moments'

describe('timeOfDayAt', () => {
  it.each<[string, string, LocalizedText]>([
    ['2026-11-20T00:05:00Z', 'Asia/Tokyo', { en: '09:05', ja: '09:05' }],
    ['2026-11-20T06:30:00Z', 'Asia/Tokyo', { en: '15:30', ja: '15:30' }],
    ['2026-11-20T15:00:00Z', 'Asia/Tokyo', { en: '00:00', ja: '00:00' }],
    ['2026-11-20T15:00:00Z', 'UTC', { en: '15:00', ja: '15:00' }],
    ['2026-07-01T16:45:00Z', 'America/New_York', { en: '12:45', ja: '12:45' }],
  ])(
    'should write the time of %s on the clock of %s, with 24 hours',
    (moment, timeZone, expected) => {
      // Act
      const written = timeOfDayAt(moment, timeZone)

      // Assert
      expect(written).toEqual(expected)
    },
  )
})

describe('momentAt', () => {
  it.each<[string, string, LocalizedText]>([
    [
      '2026-11-20T00:05:00Z',
      'Asia/Tokyo',
      { en: 'November 20, 2026 at 09:05', ja: '2026年11月20日 9:05' },
    ],
    [
      '2026-11-20T06:30:00Z',
      'Asia/Tokyo',
      { en: 'November 20, 2026 at 15:30', ja: '2026年11月20日 15:30' },
    ],
    [
      '2026-11-20T15:00:00Z',
      'Asia/Tokyo',
      { en: 'November 21, 2026 at 00:00', ja: '2026年11月21日 0:00' },
    ],
    [
      '2026-11-20T15:00:00Z',
      'UTC',
      { en: 'November 20, 2026 at 15:00', ja: '2026年11月20日 15:00' },
    ],
  ])(
    'should write the day and the time of %s on the clock of %s',
    (moment, timeZone, expected) => {
      // Act
      const written = momentAt(moment, timeZone)

      // Assert
      expect(written).toEqual(expected)
    },
  )
})
