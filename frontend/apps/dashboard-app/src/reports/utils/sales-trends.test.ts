import { formOf } from '@beauty-salon-frontend/testing/forms'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import {
  axisAmountOf,
  partNameOf,
  partsOf,
  readTrendUnit,
  scaleTopOf,
  shortPartNameOf,
  type TrendUnit,
  trendsQueryOf,
  trendUnitIn,
  twelveMonthsUntil,
} from './sales-trends'

describe('the parts of a trend', () => {
  it.each<[string, TrendUnit]>([
    ['period=daily', 'daily'],
    ['period=weekly', 'weekly'],
    ['period=monthly', 'monthly'],
    ['', 'monthly'],
    ['period=yearly', 'monthly'],
    ['period=Daily', 'monthly'],
  ])('should read the parts of the query %j', (query, unit) => {
    // Act, Assert
    expect(trendUnitIn(new URLSearchParams(query))).toBe(unit)
  })

  it('should read the parts chosen in the form, months when none is', () => {
    // Act, Assert
    expect(readTrendUnit(formOf({ period: 'weekly' }))).toBe('weekly')
    expect(readTrendUnit(new FormData())).toBe('monthly')
  })

  it('should keep the days and the parts in the query of an address', () => {
    // Act, Assert
    expect(
      trendsQueryOf(
        { from: '2026-11-01', to: '2026-11-21' },
        'weekly',
      ).toString(),
    ).toBe('from=2026-11-01&to=2026-11-21&period=weekly')
  })
})

describe('twelveMonthsUntil', () => {
  it.each<[string, string]>([
    ['2026-11-21', '2025-12-01'],
    ['2026-12-31', '2026-01-01'],
    ['2026-01-15', '2025-02-01'],
    ['2024-02-29', '2023-03-01'],
  ])(
    'should start the twelve months up to %s on the first day of the month eleven months before',
    (today, from) => {
      // Act, Assert
      expect(twelveMonthsUntil(today)).toEqual({ from, to: today })
    },
  )
})

describe('the names of the parts', () => {
  it.each<[string, TrendUnit, LocalizedText, LocalizedText]>([
    [
      '2026-11-21',
      'daily',
      { en: 'Sat, November 21, 2026', ja: '2026年11月21日（土）' },
      { en: '11/21/2026', ja: '2026/11/21' },
    ],
    [
      '2026-11-16',
      'weekly',
      {
        en: 'Week from Mon, November 16, 2026',
        ja: '2026年11月16日（月）からの週',
      },
      { en: '11/16/2026', ja: '2026/11/16' },
    ],
    [
      '2026-01-05',
      'weekly',
      {
        en: 'Week from Mon, January 5, 2026',
        ja: '2026年1月5日（月）からの週',
      },
      { en: '1/5/2026', ja: '2026/1/5' },
    ],
    [
      '2026-11',
      'monthly',
      { en: 'November 2026', ja: '2026年11月' },
      { en: 'November 2026', ja: '2026年11月' },
    ],
    [
      '2026-01',
      'monthly',
      { en: 'January 2026', ja: '2026年1月' },
      { en: 'January 2026', ja: '2026年1月' },
    ],
  ])(
    'should name %s of the parts %s in the table and on the axis',
    (label, unit, name, short) => {
      // Act, Assert
      expect(partNameOf(label, unit)).toEqual(name)
      expect(shortPartNameOf(label, unit)).toEqual(short)
    },
  )
})

describe('partsOf', () => {
  it('should put together the sums of each part from the arrays the API answers with', () => {
    // Act, Assert
    expect(
      partsOf({
        labels: ['2026-10', '2026-11'],
        sales: [11_000, 0],
        transactions: [2, 0],
        average: [5500, 0],
      }),
    ).toEqual([
      { label: '2026-10', sales: 11_000, transactions: 2, average: 5500 },
      { label: '2026-11', sales: 0, transactions: 0, average: 0 },
    ])
  })
})

describe('the scale of a chart', () => {
  it.each<[number, number]>([
    [0, 1],
    [1, 1],
    [7, 10],
    [1000, 1000],
    [1001, 2000],
    [2000, 2000],
    [2001, 5000],
    [5500, 10_000],
    [74_800, 100_000],
    [120_000, 200_000],
    [1_000_000, 1_000_000],
  ])('should end the scale of a largest amount of %s at %s', (largest, top) => {
    // Act, Assert
    expect(scaleTopOf(largest)).toBe(top)
  })

  it.each<[number, LocalizedText]>([
    [0, { en: '¥0', ja: '￥0' }],
    [5000, { en: '¥5,000', ja: '￥5,000' }],
    [9999, { en: '¥9,999', ja: '￥9,999' }],
    [10_000, { en: '¥10K', ja: '￥1万' }],
    [25_000, { en: '¥25K', ja: '￥2.5万' }],
    [1_000_000, { en: '¥1M', ja: '￥100万' }],
  ])('should write %s on an axis as %o', (amount, written) => {
    // Act, Assert
    expect(axisAmountOf(amount, 'JPY')).toEqual(written)
  })
})
