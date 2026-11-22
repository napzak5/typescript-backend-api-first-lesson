import { describe, expect, it } from 'vitest'
import { DATE } from '../../__tests__/fixtures/available-slot-fixtures'
import { CUT_ID } from '../../__tests__/fixtures/booking-fixtures'
import { brokenRules } from '../../__tests__/fixtures/fixtures'
import { STAFF_MEMBER_ID } from '../../__tests__/fixtures/staff-fixtures'
import { parseWith } from '../../shared'
import {
  availableSlotCheckRequestSchema,
  availableSlotSearchRequestSchema,
} from '../available-slot.schema'

const search = (input: unknown) =>
  parseWith(availableSlotSearchRequestSchema, input, 'Invalid')

const check = (input: unknown) =>
  parseWith(availableSlotCheckRequestSchema, input, 'Invalid')

const rulesOf = (result: ReturnType<typeof search | typeof check>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

const messagesOf = (
  result: ReturnType<typeof search | typeof check>,
): string[] =>
  result.type === 'error' && result.error.type === 'validation'
    ? result.error.issues.map(({ field, message }) => `${field}: ${message}`)
    : []

const CURSOR = `2026-11-16T01:00:00.000Z_${STAFF_MEMBER_ID}`

describe('availableSlotSearchRequestSchema', () => {
  /** A search for the slots of the service on the date, with more. */
  const searching = (more: Record<string, unknown> = {}) => ({
    serviceId: CUT_ID,
    date: DATE,
    ...more,
  })

  it('accepts a service and a date alone', () => {
    expect(search(searching())).toStrictEqual({
      type: 'success',
      data: { serviceId: CUT_ID, date: DATE },
    })
  })

  it('accepts every parameter and keeps them as they are', () => {
    const request = searching({
      limit: 50,
      cursor: CURSOR,
      staffId: STAFF_MEMBER_ID,
      duration: 90,
    })

    expect(search(request)).toStrictEqual({ type: 'success', data: request })
  })

  it('returns the IDs in lower case', () => {
    expect(
      search(
        searching({
          serviceId: CUT_ID.toUpperCase(),
          staffId: STAFF_MEMBER_ID.toUpperCase(),
        }),
      ),
    ).toStrictEqual({
      type: 'success',
      data: { serviceId: CUT_ID, date: DATE, staffId: STAFF_MEMBER_ID },
    })
  })

  it.each([
    ['a date in the past', { date: '1999-01-01' }],
    ['29 February of a leap year', { date: '2028-02-29' }],
    ['the smallest page', { limit: 1 }],
    ['the largest page', { limit: 100 }],
    ['the shortest treatment', { duration: 1 }],
    ['a treatment of a day', { duration: 1440 }],
    ['a cursor without milliseconds', { cursor: CURSOR.replace('.000', '') }],
  ])('accepts %s', (_case, more) => {
    expect(search(searching(more)).type).toBe('success')
  })

  it.each([
    [
      'no parameter at all',
      {},
      ['serviceId:invalid_type', 'date:invalid_type'],
    ],
    ['no service', { date: DATE }, ['serviceId:invalid_type']],
    ['no date', { serviceId: CUT_ID }, ['date:invalid_type']],
    [
      'a service that is not a UUID',
      searching({ serviceId: 'cut' }),
      ['serviceId:invalid_format'],
    ],
    [
      'a service that is given twice',
      searching({ serviceId: [CUT_ID, CUT_ID] }),
      ['serviceId:invalid_type'],
    ],
    [
      'a staff member that is not a UUID',
      searching({ staffId: 'hanako' }),
      ['staffId:invalid_format'],
    ],
    [
      'a staff member that is null',
      searching({ staffId: null }),
      ['staffId:invalid_type'],
    ],
    [
      'a staff member that is present without a value',
      searching({ staffId: undefined }),
      ['staffId:invalid_type'],
    ],
    [
      'a date that does not exist',
      searching({ date: '2026-02-30' }),
      ['date:invalid_format'],
    ],
    [
      'a date with a time',
      searching({ date: '2026-11-16T00:00:00Z' }),
      ['date:invalid_format'],
    ],
    [
      'a date without leading zeros',
      searching({ date: '2026-1-5' }),
      ['date:invalid_format'],
    ],
    ['an empty date', searching({ date: '' }), ['date:invalid_format']],
    ['a page of nothing', searching({ limit: 0 }), ['limit:too_small']],
    ['a page of 101', searching({ limit: 101 }), ['limit:too_big']],
    ['a page of a half', searching({ limit: 1.5 }), ['limit:invalid_type']],
    ['a limit as text', searching({ limit: '20' }), ['limit:invalid_type']],
    [
      'a limit that is present without a value',
      searching({ limit: undefined }),
      ['limit:invalid_type'],
    ],
    [
      'a treatment of no time',
      searching({ duration: 0 }),
      ['duration:too_small'],
    ],
    [
      'a treatment of more than a day',
      searching({ duration: 1441 }),
      ['duration:too_big'],
    ],
    [
      'a treatment of half a minute',
      searching({ duration: 0.5 }),
      ['duration:invalid_type'],
    ],
    [
      'a duration as text',
      searching({ duration: '60' }),
      ['duration:invalid_type'],
    ],
    [
      'a duration that is present without a value',
      searching({ duration: undefined }),
      ['duration:invalid_type'],
    ],
    [
      'a cursor of another list',
      searching({ cursor: STAFF_MEMBER_ID }),
      ['cursor:custom'],
    ],
    ['an empty cursor', searching({ cursor: '' }), ['cursor:custom']],
    [
      'a cursor with a third part',
      searching({ cursor: `${CURSOR}_1` }),
      ['cursor:custom'],
    ],
    [
      'a cursor that is given twice',
      searching({ cursor: [CURSOR, CURSOR] }),
      ['cursor:invalid_type'],
    ],
    [
      'a cursor that is present without a value',
      searching({ cursor: undefined }),
      ['cursor:invalid_type'],
    ],
    [
      'parameters the list does not have',
      searching({ salonId: CUT_ID, sortBy: 'startTime' }),
      ['salonId:unrecognized_keys', 'sortBy:unrecognized_keys'],
    ],
    [
      'everything that is wrong at once',
      { serviceId: 'cut', date: 'today', limit: 0, duration: 0, cursor: '-' },
      [
        'limit:too_small',
        'cursor:custom',
        'serviceId:invalid_format',
        'date:invalid_format',
        'duration:too_small',
      ],
    ],
  ])('rejects %s', (_case, input, rules) => {
    expect(rulesOf(search(input))).toEqual(rules)
  })

  it('says what a cursor has to be', () => {
    expect(messagesOf(search(searching({ cursor: 'next' })))).toEqual([
      'cursor: Must be the nextCursor of a page of available slots',
    ])
  })

  it.each([
    ['null', null],
    ['a list', []],
    ['a text', 'serviceId'],
  ])('rejects %s in place of the parameters', (_case, input) => {
    expect(search(input).type).toBe('error')
  })
})

describe('availableSlotCheckRequestSchema', () => {
  /** A request that asks about the staff member and the service at a time. */
  const asking = (more: Record<string, unknown> = {}) => ({
    staffId: STAFF_MEMBER_ID,
    serviceId: CUT_ID,
    startTime: '2026-11-16T01:00:00.000Z',
    ...more,
  })

  it('accepts a staff member, a service and a time, and spells the time in one way', () => {
    expect(check(asking({ startTime: '2026-11-16T01:00:00Z' }))).toStrictEqual({
      type: 'success',
      data: asking(),
    })
  })

  it('returns the IDs in lower case', () => {
    expect(
      check(
        asking({
          staffId: STAFF_MEMBER_ID.toUpperCase(),
          serviceId: CUT_ID.toUpperCase(),
        }),
      ),
    ).toStrictEqual({ type: 'success', data: asking() })
  })

  it.each([
    ['at midnight', '2026-11-16T00:00:00Z'],
    ['in the last minute of a day', '2026-11-16T23:59:00Z'],
    [
      'that has passed: the ledger takes what is entered afterwards',
      '2020-01-01T01:00:00Z',
    ],
  ])('accepts a time in UTC on a whole minute %s', (_case, startTime) => {
    expect(check(asking({ startTime })).type).toBe('success')
  })

  it.each([
    ['seconds', '2026-11-16T01:00:30Z'],
    ['a fraction of a second', '2026-11-16T01:00:00.500Z'],
  ])(
    'rejects a time with %s: a booking is made to the minute',
    (_case, startTime) => {
      expect(messagesOf(check(asking({ startTime })))).toEqual([
        'startTime: Must be on a whole minute',
      ])
      expect(rulesOf(check(asking({ startTime })))).toEqual([
        'startTime:custom',
      ])
    },
  )

  it.each([
    [
      'no property at all',
      {},
      [
        'staffId:invalid_type',
        'serviceId:invalid_type',
        'startTime:invalid_type',
      ],
    ],
    [
      'no staff member',
      { serviceId: CUT_ID, startTime: '2026-11-16T01:00:00Z' },
      ['staffId:invalid_type'],
    ],
    [
      'no service',
      { staffId: STAFF_MEMBER_ID, startTime: '2026-11-16T01:00:00Z' },
      ['serviceId:invalid_type'],
    ],
    [
      'no time',
      { staffId: STAFF_MEMBER_ID, serviceId: CUT_ID },
      ['startTime:invalid_type'],
    ],
    [
      'a staff member that is null: the question is about one',
      asking({ staffId: null }),
      ['staffId:invalid_type'],
    ],
    [
      'a service that is null',
      asking({ serviceId: null }),
      ['serviceId:invalid_type'],
    ],
    [
      'IDs that are not UUIDs',
      asking({ staffId: 'hanako', serviceId: 'cut' }),
      ['staffId:invalid_format', 'serviceId:invalid_format'],
    ],
    [
      'a time with an offset',
      asking({ startTime: '2026-11-16T10:00:00+09:00' }),
      ['startTime:invalid_format'],
    ],
    [
      'a time without a time zone',
      asking({ startTime: '2026-11-16T10:00:00' }),
      ['startTime:invalid_format'],
    ],
    [
      'a date alone',
      asking({ startTime: '2026-11-16' }),
      ['startTime:invalid_format'],
    ],
    [
      'a time as a number',
      asking({ startTime: 1794790800000 }),
      ['startTime:invalid_type'],
    ],
    [
      'properties the question does not have',
      asking({ duration: 60, date: DATE }),
      ['duration:unrecognized_keys', 'date:unrecognized_keys'],
    ],
  ])('rejects %s', (_case, input, rules) => {
    expect(rulesOf(check(input))).toEqual(rules)
  })

  it.each([
    ['null', null],
    ['a list', [asking()]],
    ['a text', 'now'],
  ])('rejects %s in place of the body', (_case, input) => {
    expect(check(input).type).toBe('error')
  })
})
