import { describe, expect, it } from 'vitest'
import { dayIn, dayQueryOf, neighboursOf, readDay } from './daily-sales'

const TODAY = '2026-11-21'

/** The values of the form with a day filled in */
const formWith = (date: string): FormData => {
  const values = new FormData()
  values.set('date', date)

  return values
}

describe('dayIn', () => {
  it.each<[string, string]>([
    ['date=2026-11-20', '2026-11-20'],
    ['date=2026-11-22', '2026-11-22'],
    ['', TODAY],
    ['date=2026-02-29', TODAY],
    ['date=1899-12-31', TODAY],
    ['date=2026-11-20T10:00', TODAY],
  ])(
    'should read the day of the query %j, today when it is none the API counts',
    (query, day) => {
      // Act, Assert
      expect(dayIn(new URLSearchParams(query), TODAY)).toBe(day)
    },
  )

  it('should keep a day in the query of an address', () => {
    // Act, Assert
    expect(dayQueryOf('2026-11-20').toString()).toBe('date=2026-11-20')
  })
})

describe('readDay', () => {
  it('should take a day of the calendar, without the spaces around it', () => {
    // Act, Assert
    expect(readDay(formWith(' 2026-11-20 '))).toEqual({
      type: 'valid',
      request: '2026-11-20',
    })
  })

  it.each<string>(['', '2026-02-29', '3000-01-01'])(
    'should say beside the field that %j is not a day',
    (date) => {
      // Act, Assert
      expect(readDay(formWith(date))).toEqual({
        type: 'invalid',
        errors: { date: '日付を入力してください。' },
      })
    },
  )
})

describe('neighboursOf', () => {
  it('should lead from a day before today to the days before and after it', () => {
    // Act, Assert
    expect(neighboursOf('2026-03-01', TODAY)).toEqual({
      before: '2026-02-28',
      after: '2026-03-02',
    })
  })

  it('should lead from today to no day after it, whose sales are not entered yet', () => {
    // Act, Assert
    expect(neighboursOf(TODAY, TODAY)).toEqual({
      before: '2026-11-20',
      after: undefined,
    })
    expect(neighboursOf('2026-11-25', TODAY).after).toBeUndefined()
  })

  it('should lead from the first day the API takes to no day before it', () => {
    // Act, Assert
    expect(neighboursOf('1900-01-01', TODAY)).toEqual({
      before: undefined,
      after: '1900-01-02',
    })
  })
})
