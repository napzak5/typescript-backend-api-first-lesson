import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../languages/localized-text'
import { durationOf, minutesOf, timeRangeOf, timeSlotsOf } from './times'

describe('durationOf', () => {
  it.each<[number, LocalizedText]>([
    [45, { en: '45 min', ja: '45 分' }],
    [60, { en: '1 hr', ja: '1 時間' }],
    [90, { en: '1 hr 30 min', ja: '1 時間 30 分' }],
    [120, { en: '2 hr', ja: '2 時間' }],
    [0, { en: '0 min', ja: '0 分' }],
  ])(
    'should write %d minutes in hours and minutes in each language',
    (minutes, expected) => {
      // Act
      const written = durationOf(minutes)

      // Assert
      expect(written).toEqual(expected)
    },
  )
})

describe('minutesOf', () => {
  it.each<[number, LocalizedText]>([
    [0, { en: '0 min', ja: '0 分' }],
    [45, { en: '45 min', ja: '45 分' }],
    [90, { en: '90 min', ja: '90 分' }],
    [1440, { en: '1,440 min', ja: '1,440 分' }],
  ])(
    'should write %d minutes in minutes alone in each language',
    (minutes, expected) => {
      // Act
      const written = minutesOf(minutes)

      // Assert
      expect(written).toEqual(expected)
    },
  )

  it.each<[number, LocalizedText]>([
    [72.46, { en: '72.5 min', ja: '72.5 分' }],
    [72, { en: '72 min', ja: '72 分' }],
    [1234.56, { en: '1,234.6 min', ja: '1,234.6 分' }],
  ])(
    'should write %d minutes with at most the decimals it is given',
    (minutes, expected) => {
      // Act
      const written = minutesOf(minutes, { most: 1 })

      // Assert
      expect(written).toEqual(expected)
    },
  )

  it('should write as many as three decimals when it is given none', () => {
    // Act
    const written = minutesOf(72.4567)

    // Assert
    expect(written).toEqual({ en: '72.457 min', ja: '72.457 分' })
  })
})

describe('timeSlotsOf', () => {
  it('should write each slot from when until when, as a sentence of each language lists them', () => {
    // Act
    const written = timeSlotsOf([
      { startTime: '10:00', endTime: '12:00' },
      { startTime: '14:00', endTime: '16:00' },
    ])

    // Assert
    expect(written).toEqual({
      en: '10:00–12:00, 14:00–16:00',
      ja: '10:00〜12:00、14:00〜16:00',
    })
  })

  it('should leave out the seconds of a time the API writes with them', () => {
    // Act
    const written = timeSlotsOf([
      { startTime: '10:00:00', endTime: '20:00:00' },
    ])

    // Assert
    expect(written).toEqual({ en: '10:00–20:00', ja: '10:00〜20:00' })
  })

  it('should write nothing of no slot', () => {
    // Act
    const written = timeSlotsOf([])

    // Assert
    expect(written).toEqual({ en: '', ja: '' })
  })
})

describe('timeRangeOf', () => {
  it.each<[string, string, LocalizedText]>([
    ['09:00', '20:00', { en: '09:00–20:00', ja: '09:00〜20:00' }],
    ['09:00:30', '13:00', { en: '09:00:30–13:00', ja: '09:00:30〜13:00' }],
  ])(
    'should write from %s until %s as each language joins two times',
    (from, to, expected) => {
      // Act
      const written = timeRangeOf(from, to)

      // Assert
      expect(written).toEqual(expected)
    },
  )
})
