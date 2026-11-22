import type { Period } from '@beauty-salon-frontend/salon-screens'
import { describe, expect, it } from 'vitest'
import {
  averageNameOf,
  countNameOf,
  statisticsPeriodIn,
} from './treatment-statistics'

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

describe('countNameOf', () => {
  it('should say how many records were counted', () => {
    expect([countNameOf(0), countNameOf(12)]).toEqual(['0 件', '12 件'])
  })
})

describe('averageNameOf', () => {
  it.each<[number | null, string | null]>([
    [72.5, '72.5 分'],
    [80, '80 分'],
    [1234.5, '1,234.5 分'],
    [null, null],
  ])('should say the average of %s', (minutes, name) => {
    expect(averageNameOf(minutes)).toBe(name)
  })
})
