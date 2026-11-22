import { describe, expect, it } from 'vitest'
import { averageOf, percentageOf } from '..'
import { datesOf, daysIn, mondayOf, monthOf } from '../_shared/calendar'

describe('the calendar of the reports', () => {
  it('counts the days of a period with both of its ends', () => {
    expect(daysIn('2026-11-20', '2026-11-20')).toBe(1)
    expect(daysIn('2026-11-01', '2026-11-30')).toBe(30)
    expect(daysIn('2025-01-01', '2025-12-31')).toBe(365)
  })

  it('counts the 29th of February of a leap year, and no such day of another year', () => {
    expect(daysIn('2028-02-28', '2028-03-01')).toBe(3)
    expect(daysIn('2027-02-28', '2027-03-01')).toBe(2)
    expect(daysIn('2028-01-01', '2028-12-31')).toBe(366)
  })

  it('counts every day as one, on the days the clocks of a time zone change', () => {
    expect(daysIn('2026-03-07', '2026-03-09')).toBe(3)
    expect(daysIn('2026-10-31', '2026-11-02')).toBe(3)
  })

  it('names every date of a period in its order, across the end of a month and of a year', () => {
    expect(datesOf('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ])
    expect(datesOf('2028-02-28', '2028-03-01')).toEqual([
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ])
    expect(datesOf('2026-11-20', '2026-11-20')).toEqual(['2026-11-20'])
  })

  it.each([
    ['a Monday', '2026-11-16', '2026-11-16'],
    ['a Wednesday', '2026-11-18', '2026-11-16'],
    ['a Sunday, the last day of its week', '2026-11-22', '2026-11-16'],
    ['a day whose Monday is in the year before', '2027-01-01', '2026-12-28'],
    ['a day whose Monday is in the month before', '2026-12-02', '2026-11-30'],
  ])('finds the Monday of the week of %s', (_case, date, monday) => {
    expect(mondayOf(date)).toBe(monday)
  })

  it('finds the month of a date', () => {
    expect(monthOf('2026-11-20')).toBe('2026-11')
    expect(monthOf('2027-01-01')).toBe('2027-01')
  })
})

describe('averageOf', () => {
  it('drops the fraction of a yen', () => {
    expect(averageOf(10000, 3)).toBe(3333)
    expect(averageOf(20000, 3)).toBe(6666)
    expect(averageOf(9000, 3)).toBe(3000)
  })

  it('is 0 when there is nothing to divide by', () => {
    expect(averageOf(0, 0)).toBe(0)
    expect(averageOf(5000, 0)).toBe(0)
  })
})

describe('percentageOf', () => {
  it('gives a part in per cent to one decimal place, rounded', () => {
    expect(percentageOf(1, 3)).toBe(33.3)
    expect(percentageOf(2, 3)).toBe(66.7)
    expect(percentageOf(1, 8)).toBe(12.5)
    expect(percentageOf(1, 2000)).toBe(0.1)
    expect(percentageOf(1, 2001)).toBe(0)
  })

  it('gives 100 for the whole and 0 for nothing of it', () => {
    expect(percentageOf(42000, 42000)).toBe(100)
    expect(percentageOf(0, 42000)).toBe(0)
  })

  it('is 0 of a whole of 0', () => {
    expect(percentageOf(0, 0)).toBe(0)
  })
})
