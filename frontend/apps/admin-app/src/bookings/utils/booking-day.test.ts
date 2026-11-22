import { formOfEntries } from '@beauty-salon-frontend/testing/forms'
import { describe, expect, it } from 'vitest'
import {
  conditionsIn,
  conditionsOf,
  type DayConditions,
  narrows,
  onDay,
  queryOf,
  wholeDay,
} from './booking-day'

const TODAY = '2026-11-20'
const STAFF_ID = '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c03'

describe('conditionsIn', () => {
  it('should read the day, the state and the member of the staff', () => {
    expect(
      conditionsIn(
        new URLSearchParams(
          `date=2026-11-24&status=confirmed&staffId=${STAFF_ID}`,
        ),
        TODAY,
      ),
    ).toEqual({ date: '2026-11-24', status: 'confirmed', staffId: STAFF_ID })
  })

  it.each([
    ['no day', ''],
    ['an empty day', 'date='],
    ['a day that does not exist', 'date=2026-02-30'],
    ['a day the API does not take', 'date=3000-01-01'],
    ['what is no day', 'date=tomorrow'],
  ])('should show today at the salon for %s', (_case, query) => {
    expect(conditionsIn(new URLSearchParams(query), TODAY)).toEqual({
      date: TODAY,
    })
  })

  it.each([
    ['a state that is not one', 'status=done'],
    ['a member of the staff that is no ID', 'staffId=tanaka'],
    ['a parameter that is no condition', 'limit=5'],
  ])('should leave out %s', (_case, query) => {
    expect(
      conditionsIn(new URLSearchParams(`date=2026-11-24&${query}`), TODAY),
    ).toEqual({ date: '2026-11-24' })
  })
})

describe('conditionsOf', () => {
  it('should read what was filled in', () => {
    expect(
      conditionsOf(
        formOfEntries([
          ['date', '2026-11-24'],
          ['status', 'no_show'],
          ['staffId', STAFF_ID],
        ]),
        TODAY,
      ),
    ).toEqual({ date: '2026-11-24', status: 'no_show', staffId: STAFF_ID })
  })

  it('should read the choices of every state and every member as no condition', () => {
    expect(
      conditionsOf(
        formOfEntries([
          ['date', '2026-11-24'],
          ['status', ''],
          ['staffId', ''],
        ]),
        TODAY,
      ),
    ).toEqual({ date: '2026-11-24' })
  })

  it('should show today for an empty day', () => {
    expect(conditionsOf(formOfEntries([['date', '']]), TODAY)).toEqual({
      date: TODAY,
    })
  })
})

describe('queryOf', () => {
  it('should write the conditions in one order, whatever order they came in', () => {
    expect(
      queryOf({
        staffId: STAFF_ID,
        status: 'pending',
        date: '2026-11-24',
      }).toString(),
    ).toBe(`date=2026-11-24&status=pending&staffId=${STAFF_ID}`)
  })

  it('should write the day alone when nothing narrows it', () => {
    expect(queryOf({ date: '2026-11-24' }).toString()).toBe('date=2026-11-24')
  })
})

const NARROWING: [string, DayConditions, boolean][] = [
  ['the whole day', { date: TODAY }, false],
  ['a state', { date: TODAY, status: 'pending' }, true],
  ['a member of the staff', { date: TODAY, staffId: STAFF_ID }, true],
]

describe('narrows', () => {
  it.each(NARROWING)(
    'should tell whether %s narrows the list',
    (_case, conditions, narrowed) => {
      expect(narrows(conditions)).toBe(narrowed)
    },
  )
})

describe('onDay and wholeDay', () => {
  it('should keep the state and the member on another day', () => {
    expect(onDay({ date: TODAY, status: 'pending' }, '2026-11-21')).toEqual({
      date: '2026-11-21',
      status: 'pending',
    })
  })

  it('should keep the day alone for the whole day', () => {
    expect(
      wholeDay({ date: TODAY, status: 'pending', staffId: STAFF_ID }),
    ).toEqual({ date: TODAY })
  })
})
