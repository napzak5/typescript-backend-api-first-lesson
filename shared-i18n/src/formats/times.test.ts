import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../languages/localized-text'
import { durationOf, timeSlotsOf } from './times'

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
