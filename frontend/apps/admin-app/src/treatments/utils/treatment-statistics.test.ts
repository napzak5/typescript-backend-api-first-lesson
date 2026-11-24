import type { Period } from '@beauty-salon-frontend/salon-screens'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import { averageNameOf, statisticsPeriodIn } from './treatment-statistics'

const TODAY = '2026-11-20'

describe('statisticsPeriodIn', () => {
  it.each<[string, string, Period]>([
    [
      'the days it names',
      'from=2025-01-01&to=2026-10-31',
      { from: '2025-01-01', to: '2026-10-31' },
    ],
    [
      'a single day',
      'from=2026-10-31&to=2026-10-31',
      { from: '2026-10-31', to: '2026-10-31' },
    ],
    [
      'the month up to today, without days',
      '',
      { from: '2026-11-01', to: TODAY },
    ],
    [
      'the month up to today, with one day only',
      'from=2026-10-01',
      { from: '2026-11-01', to: TODAY },
    ],
    [
      'the month up to today, with a day that is none',
      'from=2026-02-30&to=2026-03-01',
      { from: '2026-11-01', to: TODAY },
    ],
    [
      'the month up to today, with a last day before the first',
      'from=2026-10-31&to=2026-10-01',
      { from: '2026-11-01', to: TODAY },
    ],
  ])('should read %s', (_case, query, period) => {
    expect(statisticsPeriodIn(new URLSearchParams(query), TODAY)).toEqual(
      period,
    )
  })
})

describe('averageNameOf', () => {
  it.each<[number | null, LocalizedText | null]>([
    [72.5, { en: '72.5 min', ja: '72.5 分' }],
    [72.25, { en: '72.3 min', ja: '72.3 分' }],
    [80, { en: '80 min', ja: '80 分' }],
    [1234.5, { en: '1,234.5 min', ja: '1,234.5 分' }],
    [null, null],
  ])('should say the average of %s', (minutes, name) => {
    // Act
    const said = averageNameOf(minutes)

    // Assert
    expect(said).toEqual(name)
  })
})
