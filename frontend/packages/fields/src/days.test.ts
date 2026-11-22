import { describe, expect, it } from 'vitest'
import { EARLIEST_DAY, isDay, LATEST_DAY } from './days'

describe('isDay', () => {
  it.each<[string, string, boolean]>([
    ['a day', '2026-11-20', true],
    ['the first day the API takes', '1900-01-01', true],
    ['the last day the API takes', '2999-12-31', true],
    ['the 29th of February of a leap year', '2028-02-29', true],
    ['a day before the first', '1899-12-31', false],
    ['a day after the last', '3000-01-01', false],
    ['the 29th of February of another year', '2026-02-29', false],
    ['a month that does not exist', '2026-13-01', false],
    ['a moment', '2026-11-20T10:00', false],
    ['a day without its zeros', '2026-1-2', false],
    ['a month', '2026-11', false],
    ['a year', '2026', false],
    ['nothing', '', false],
  ])('should tell %s', (_case, text, day) => {
    expect(isDay(text)).toBe(day)
  })
})

describe('the days the API takes', () => {
  it('should run from the first day of 1900 to the last of 2999', () => {
    expect([EARLIEST_DAY, LATEST_DAY]).toEqual(['1900-01-01', '2999-12-31'])
  })
})
