import { describe, expect, it } from 'vitest'
import {
  bookingCancelRequestSchema,
  bookingCompleteRequestSchema,
  bookingCreateRequestSchema,
  bookingSearchRequestSchema,
} from '../schemas/booking.schema'
import { parseWith } from '../shared'
import { CUSTOMER_ID } from './auth-fixtures'
import {
  BOOKING_ID,
  bookingCreateRequest,
  COLOR_ID,
  CUT_ID,
} from './booking-fixtures'
import { brokenRules, SALON_ID } from './fixtures'
import { STAFF_MEMBER_ID } from './staff-fixtures'

const rulesBrokenBy = (
  schema: Parameters<typeof parseWith>[0],
  input: unknown,
): string[] => {
  const result = parseWith(schema, input, 'Invalid')
  return result.type === 'error' ? brokenRules(result.error) : []
}

const parseCreate = (input: unknown) =>
  parseWith(bookingCreateRequestSchema, input, 'Invalid')

const rulesOfCreate = (input: unknown): string[] =>
  rulesBrokenBy(bookingCreateRequestSchema, input)

const parseCancel = (input: unknown) =>
  parseWith(bookingCancelRequestSchema, input, 'Invalid')

const rulesOfCancel = (input: unknown): string[] =>
  rulesBrokenBy(bookingCancelRequestSchema, input)

const parseComplete = (input: unknown) =>
  parseWith(bookingCompleteRequestSchema, input, 'Invalid')

const rulesOfComplete = (input: unknown): string[] =>
  rulesBrokenBy(bookingCompleteRequestSchema, input)

/** A complete request with these times. */
const times = (actualStartTime: unknown, actualEndTime: unknown) => ({
  actualStartTime,
  actualEndTime,
})

const parseSearch = (input: unknown) =>
  parseWith(bookingSearchRequestSchema, input, 'Invalid')

const rulesOfSearch = (input: unknown): string[] =>
  rulesBrokenBy(bookingSearchRequestSchema, input)

/** A service line that keeps every rule. */
const line = (overrides: Record<string, unknown> = {}) => ({
  serviceId: CUT_ID,
  staffId: STAFF_MEMBER_ID,
  startTime: '2026-11-20T01:00:00Z',
  notes: null,
  ...overrides,
})

/** The request of the fixtures with these service lines. */
const withLines = (...services: unknown[]) => ({
  ...bookingCreateRequest(),
  services,
})

/** The request of the fixtures with one service line that begins then. */
const startingAt = (startTime: unknown) => withLines(line({ startTime }))

/** The start times of an accepted request; empty for a refused one. */
const startTimesOf = (input: unknown): string[] => {
  const result = parseCreate(input)
  return result.type === 'success'
    ? result.data.services.map(({ startTime }) => startTime)
    : []
}

describe('bookingCreateRequestSchema', () => {
  it('accepts a request that keeps every rule and spells its times in one way', () => {
    const request = bookingCreateRequest()

    expect(parseCreate(request)).toEqual({
      type: 'success',
      data: {
        ...request,
        services: [
          { ...request.services[0], startTime: '2026-11-20T01:00:00.000Z' },
          { ...request.services[1], startTime: '2026-11-20T02:00:00.000Z' },
        ],
      },
    })
  })

  it.each(['depositAmount', 'customerRequest', 'internalNotes', 'source'])(
    'accepts null for %s',
    (property) => {
      const result = parseCreate({
        ...bookingCreateRequest(),
        [property]: null,
      })

      expect(result).toMatchObject({
        type: 'success',
        data: { [property]: null },
      })
    },
  )

  it.each(['staffId', 'notes'])(
    'accepts null for %s of a service',
    (property) => {
      const result = parseCreate(withLines(line({ [property]: null })))

      expect(result).toMatchObject({
        type: 'success',
        data: { services: [{ [property]: null }] },
      })
    },
  )

  it.each(Object.keys(bookingCreateRequest()))(
    'requires %s: nothing of a new booking is optional',
    (property) => {
      const { [property]: _omitted, ...request }: Record<string, unknown> =
        bookingCreateRequest()

      expect(rulesOfCreate(request)).toEqual([`${property}:invalid_type`])
    },
  )

  it.each(Object.keys(line()))('requires %s of a service', (property) => {
    const { [property]: _omitted, ...service }: Record<string, unknown> = line()

    expect(rulesOfCreate(withLines(service))).toEqual([
      `services.0.${property}:invalid_type`,
    ])
  })

  it.each([
    ['the status', 'status', 'confirmed'],
    ['the booking number', 'bookingNumber', 'BK-0000-0001'],
    ['the day of the visit', 'bookingDate', '2026-11-20'],
    ['the total', 'totalAmount', 0],
    ['the tax', 'taxAmount', 0],
    ['the end', 'endTime', '2026-11-20T03:00:00Z'],
  ])(
    'refuses %s, which a booking gets from the system',
    (_case, property, value) => {
      expect(
        rulesOfCreate({ ...bookingCreateRequest(), [property]: value }),
      ).toEqual([`${property}:unrecognized_keys`])
    },
  )

  it.each([
    ['the price', 'price', 0],
    ['the duration', 'duration', 5],
    ['the end', 'endTime', '2026-11-20T03:00:00Z'],
    ['the discount', 'discountAmount', 6600],
    ['the position', 'sortOrder', 3],
  ])(
    'refuses %s of a service, which a service line gets from its service',
    (_case, property, value) => {
      expect(rulesOfCreate(withLines(line({ [property]: value })))).toEqual([
        `services.0.${property}:unrecognized_keys`,
      ])
    },
  )

  it.each([
    ['salonId', { salonId: 'not-an-id' }],
    ['customerId', { customerId: 'not-an-id' }],
    ['staffId', { staffId: 'not-an-id' }],
    ['staffId', { staffId: null }],
  ])('refuses a value of %s that is no ID', (property, change) => {
    expect(
      rulesOfCreate({ ...bookingCreateRequest(), ...change }),
    ).toHaveLength(1)
    expect(rulesOfCreate({ ...bookingCreateRequest(), ...change })[0]).toMatch(
      new RegExp(`^${property}:`),
    )
  })

  it.each(['serviceId', 'staffId'])(
    'refuses a value of %s of a service that is no ID',
    (property) => {
      const rules = rulesOfCreate(withLines(line({ [property]: 'not-an-id' })))

      expect(rules).toHaveLength(1)
      expect(rules[0]).toMatch(new RegExp(`^services\\.0\\.${property}:`))
    },
  )

  it.each([
    ['nothing', 0],
    ['one yen', 1],
    ['the largest amount of the column', 2_147_483_647],
  ])('accepts a deposit of %s', (_case, depositAmount) => {
    expect(
      parseCreate({ ...bookingCreateRequest(), depositAmount }),
    ).toMatchObject({ type: 'success', data: { depositAmount } })
  })

  it.each([
    ['a negative amount', -1, 'too_small'],
    ['a fraction of a yen', 1000.5, 'invalid_type'],
    ['more than the column holds', 2_147_483_648, 'too_big'],
    ['an amount as text', '1000', 'invalid_type'],
  ])('refuses a deposit of %s', (_case, depositAmount, rule) => {
    expect(rulesOfCreate({ ...bookingCreateRequest(), depositAmount })).toEqual(
      [`depositAmount:${rule}`],
    )
  })

  it.each(['customerRequest', 'internalNotes', 'source'])(
    'refuses a %s that says nothing: one that is not there is null',
    (property) => {
      expect(
        rulesOfCreate({ ...bookingCreateRequest(), [property]: '' }),
      ).toEqual([`${property}:invalid_format`])
      expect(
        rulesOfCreate({ ...bookingCreateRequest(), [property]: ' \t\n' }),
      ).toEqual([`${property}:invalid_format`])
    },
  )

  it('refuses notes of a service that say nothing', () => {
    expect(rulesOfCreate(withLines(line({ notes: '  ' })))).toEqual([
      'services.0.notes:invalid_format',
    ])
  })

  it('keeps the source within the 50 characters of its column', () => {
    expect(
      parseCreate({ ...bookingCreateRequest(), source: 'a'.repeat(50) }).type,
    ).toBe('success')
    expect(
      rulesOfCreate({ ...bookingCreateRequest(), source: 'a'.repeat(51) }),
    ).toEqual(['source:too_big'])
  })

  it('refuses a booking without a service', () => {
    expect(rulesOfCreate(withLines())).toEqual(['services:too_small'])
  })

  it('takes up to 20 services', () => {
    const lines = (count: number) => Array.from({ length: count }, () => line())

    expect(parseCreate(withLines(...lines(20))).type).toBe('success')
    expect(rulesOfCreate(withLines(...lines(21)))).toEqual(['services:too_big'])
  })

  it.each([
    ['with seconds', '2026-11-20T01:00:00Z'],
    ['with a fraction of zero', '2026-11-20T01:00:00.000Z'],
    ['at midnight', '2026-11-20T00:00:00Z'],
    ['in the last minute of a day', '2026-11-20T23:59:00Z'],
  ])('accepts a time in UTC on a whole minute: %s', (_case, startTime) => {
    expect(parseCreate(startingAt(startTime)).type).toBe('success')
  })

  it('returns two spellings of one moment as the same text', () => {
    expect(startTimesOf(startingAt('2026-11-20T01:00:00Z'))).toEqual(
      startTimesOf(startingAt('2026-11-20T01:00:00.000Z')),
    )
    expect(startTimesOf(startingAt('2026-11-20T01:00:00Z'))).toEqual([
      '2026-11-20T01:00:00.000Z',
    ])
  })

  it.each([
    ['seconds', '2026-11-20T01:00:30Z'],
    ['a fraction of a second', '2026-11-20T01:00:00.500Z'],
  ])(
    'refuses a time with %s: a booking is made to the minute',
    (_case, startTime) => {
      expect(rulesOfCreate(startingAt(startTime))).toEqual([
        'services.0.startTime:custom',
      ])
    },
  )

  it.each([
    ['an offset', '2026-11-20T10:00:00+09:00'],
    ['no time zone', '2026-11-20T01:00:00'],
    ['no seconds', '2026-11-20T01:00Z'],
    ['a date only', '2026-11-20'],
    ['a day that does not exist', '2026-02-30T01:00:00Z'],
    ['a space for the T', '2026-11-20 01:00:00Z'],
    ['a number', 1_795_000_000_000],
    ['an empty text', ''],
  ])(
    'refuses a time that is not a UTC time of ISO 8601: %s',
    (_case, startTime) => {
      const rules = rulesOfCreate(startingAt(startTime))

      expect(rules).toHaveLength(1)
      expect(rules[0]).toMatch(/^services\.0\.startTime:invalid_/)
    },
  )

  it('accepts a time that has passed: what was not entered in time is entered afterwards', () => {
    expect(parseCreate(startingAt('2020-01-01T01:00:00Z')).type).toBe('success')
  })

  it('accepts the same service twice, and services at the same time', () => {
    const request = withLines(line(), line(), line({ serviceId: COLOR_ID }))

    expect(parseCreate(request).type).toBe('success')
  })

  it('accepts a service that begins 24 hours after the earliest one', () => {
    const request = withLines(
      line({ startTime: '2026-11-20T01:00:00Z' }),
      line({ startTime: '2026-11-21T01:00:00Z' }),
    )

    expect(parseCreate(request).type).toBe('success')
  })

  it('refuses a service that begins later than that, under its own start time', () => {
    const request = withLines(
      line({ startTime: '2026-11-20T01:00:00Z' }),
      line({ startTime: '2026-11-21T01:01:00Z' }),
      line({ startTime: '2026-11-20T02:00:00Z' }),
      line({ startTime: '2027-11-20T01:00:00Z' }),
    )

    expect(rulesOfCreate(request)).toEqual([
      'services.1.startTime:custom',
      'services.3.startTime:custom',
    ])
  })

  it('measures the 24 hours from the earliest service, wherever it stands in the list', () => {
    const request = withLines(
      line({ startTime: '2026-11-21T01:01:00Z' }),
      line({ startTime: '2026-11-20T01:00:00Z' }),
    )

    expect(rulesOfCreate(request)).toEqual(['services.0.startTime:custom'])
  })

  it('says what is wrong with a service that begins too late', () => {
    const result = parseCreate(
      withLines(
        line({ startTime: '2026-11-20T01:00:00Z' }),
        line({ startTime: '2026-11-22T01:00:00Z' }),
      ),
    )

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        issues: [
          {
            field: 'services.1.startTime',
            message: 'Must be within 24 hours of the earliest service',
          },
        ],
      },
    })
  })

  it('reports every broken rule at once', () => {
    expect(
      rulesOfCreate({
        ...bookingCreateRequest(),
        depositAmount: -1,
        source: '',
        services: [line({ startTime: '2026-11-20T01:00:30Z', notes: '' })],
      }).toSorted(),
    ).toEqual([
      'depositAmount:too_small',
      'services.0.notes:invalid_format',
      'services.0.startTime:custom',
      'source:invalid_format',
    ])
  })

  it.each([
    ['a list', []],
    ['a text', 'booking'],
    ['null', null],
  ])('refuses %s for a request', (_case, input) => {
    expect(rulesOfCreate(input)).toEqual([':invalid_type'])
  })
})

describe('bookingCancelRequestSchema', () => {
  it('accepts a reason and returns it as it was written', () => {
    const request = { cancellationReason: '  お客様のご都合により  ' }

    expect(parseCancel(request)).toEqual({ type: 'success', data: request })
  })

  it('accepts null for the reason: none was given', () => {
    expect(parseCancel({ cancellationReason: null })).toEqual({
      type: 'success',
      data: { cancellationReason: null },
    })
  })

  it('requires the reason to be stated, if only as null', () => {
    expect(rulesOfCancel({})).toEqual(['cancellationReason:invalid_type'])
  })

  it.each([
    ['an empty text', ''],
    ['spaces', '   '],
    ['a line break', '\n'],
  ])('refuses a reason that says nothing: %s', (_case, cancellationReason) => {
    expect(rulesOfCancel({ cancellationReason })).toEqual([
      'cancellationReason:invalid_format',
    ])
  })

  it.each([
    ['a number', 1],
    ['a list', ['x']],
    ['true', true],
  ])('refuses %s for the reason', (_case, cancellationReason) => {
    expect(rulesOfCancel({ cancellationReason })).toEqual([
      'cancellationReason:invalid_type',
    ])
  })

  it('sets no limit to the length of the reason: its column has none', () => {
    expect(parseCancel({ cancellationReason: 'x'.repeat(10_000) }).type).toBe(
      'success',
    )
  })

  it.each(['cancelledAt', 'cancelledBy', 'cancellationFee', 'status', 'id'])(
    "refuses %s: what the system notes is not the request's to state",
    (property) => {
      expect(
        rulesOfCancel({ cancellationReason: null, [property]: null }),
      ).toEqual([`${property}:unrecognized_keys`])
    },
  )

  it.each([
    ['null', null],
    ['a list', []],
    ['a text', 'x'],
    ['nothing', undefined],
  ])('refuses %s for a request', (_case, input) => {
    expect(rulesOfCancel(input)).toEqual([':invalid_type'])
  })
})

describe('bookingCompleteRequestSchema', () => {
  it('accepts a request without times: the booking keeps those it has', () => {
    expect(parseComplete(times(null, null))).toEqual({
      type: 'success',
      data: times(null, null),
    })
  })

  it('accepts both times and spells them in one way', () => {
    expect(
      parseComplete(times('2026-11-20T01:05:00Z', '2026-11-20T03:20:30Z')),
    ).toEqual({
      type: 'success',
      data: times('2026-11-20T01:05:00.000Z', '2026-11-20T03:20:30.000Z'),
    })
  })

  it.each([
    ['the start alone', times('2026-11-20T01:05:00.000Z', null)],
    ['the end alone', times(null, '2026-11-20T03:20:30.000Z')],
  ])('accepts %s', (_case, request) => {
    expect(parseComplete(request)).toEqual({ type: 'success', data: request })
  })

  it('takes a time to the millisecond, not to the minute: it is when something happened', () => {
    expect(
      parseComplete(
        times('2026-11-20T01:05:07.123Z', '2026-11-20T03:20:30.999Z'),
      ),
    ).toEqual({
      type: 'success',
      data: times('2026-11-20T01:05:07.123Z', '2026-11-20T03:20:30.999Z'),
    })
  })

  it('cuts what a time has beyond the millisecond', () => {
    expect(parseComplete(times('2026-11-20T01:05:07.123999Z', null))).toEqual({
      type: 'success',
      data: times('2026-11-20T01:05:07.123Z', null),
    })
  })

  it.each([
    ['actualStartTime', { actualEndTime: null }],
    ['actualEndTime', { actualStartTime: null }],
  ])('requires %s to be stated, if only as null', (property, request) => {
    expect(rulesOfComplete(request)).toEqual([`${property}:invalid_type`])
  })

  it.each([
    ['an offset', '2026-11-20T10:05:00+09:00'],
    ['no time zone', '2026-11-20T01:05:00'],
    ['a date only', '2026-11-20'],
    ['a day that does not exist', '2026-02-30T01:05:00Z'],
    ['a space for the T', '2026-11-20 01:05:00Z'],
    ['a number', 1_795_000_000_000],
    ['an empty text', ''],
  ])('refuses a time that is not a UTC time of ISO 8601: %s', (_case, time) => {
    const ofStart = rulesOfComplete(times(time, null))
    const ofEnd = rulesOfComplete(times(null, time))

    expect(ofStart).toHaveLength(1)
    expect(ofStart[0]).toMatch(/^actualStartTime:invalid_/)
    expect(ofEnd).toHaveLength(1)
    expect(ofEnd[0]).toMatch(/^actualEndTime:invalid_/)
  })

  it.each([
    ['the start', '2026-11-20T01:05:00Z', '2026-11-20T01:05:00.000Z'],
    [
      'a millisecond before the start',
      '2026-11-20T01:05:00Z',
      '2026-11-20T01:04:59.999Z',
    ],
    ['a day before the start', '2026-11-20T01:05:00Z', '2026-11-19T03:00:00Z'],
  ])('refuses an end that is %s, under the end', (_case, start, end) => {
    const result = parseComplete(times(start, end))

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        issues: [
          {
            field: 'actualEndTime',
            rule: 'custom',
            message: 'Must be after actualStartTime',
          },
        ],
      },
    })
  })

  it('accepts an end a millisecond after the start', () => {
    expect(
      parseComplete(times('2026-11-20T01:05:00Z', '2026-11-20T01:05:00.001Z'))
        .type,
    ).toBe('success')
  })

  it('compares the moments, not the texts: a fraction that is spelled out does not come first', () => {
    expect(
      parseComplete(times('2026-11-20T01:05:00.5Z', '2026-11-20T01:05:00.50Z'))
        .type,
    ).toBe('error')
    expect(
      parseComplete(times('2026-11-20T01:05:00Z', '2026-11-20T01:05:00.1Z'))
        .type,
    ).toBe('success')
  })

  it('does not ask how the times stand to the time the booking was made for, or to now', () => {
    expect(
      parseComplete(times('2020-01-01T00:00:00Z', '2099-01-01T00:00:00Z')).type,
    ).toBe('success')
  })

  it.each(['completedAt', 'status', 'id', 'services'])(
    "refuses %s: what the system notes is not the request's to state",
    (property) => {
      expect(
        rulesOfComplete({ ...times(null, null), [property]: null }),
      ).toEqual([`${property}:unrecognized_keys`])
    },
  )

  it.each([
    ['null', null],
    ['a list', []],
    ['a text', 'x'],
    ['nothing', undefined],
  ])('refuses %s for a request', (_case, input) => {
    expect(rulesOfComplete(input)).toEqual([':invalid_type'])
  })

  it('reports a time that is none and does not compare it', () => {
    expect(rulesOfComplete(times('2026-11-20T03:00:00Z', 'soon'))).toEqual([
      'actualEndTime:invalid_format',
    ])
  })
})

describe('bookingSearchRequestSchema', () => {
  it('accepts a search without a condition', () => {
    expect(parseSearch({})).toEqual({ type: 'success', data: {} })
  })

  it('accepts every condition together and returns the search unchanged', () => {
    const search = {
      limit: 50,
      cursor: BOOKING_ID,
      salonId: SALON_ID,
      customerId: CUSTOMER_ID,
      staffId: STAFF_MEMBER_ID,
      status: 'confirmed',
      bookingDateFrom: '2026-11-01',
      bookingDateTo: '2026-11-30',
    }

    expect(parseSearch(search)).toEqual({ type: 'success', data: search })
  })

  it.each([
    'draft',
    'pending',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled',
    'no_show',
  ])('accepts the status %s', (status) => {
    expect(parseSearch({ status }).type).toBe('success')
  })

  it.each([
    ['a status that does not exist', 'done'],
    ['a status in capitals', 'PENDING'],
    ['an empty status', ''],
  ])('refuses %s', (_case, status) => {
    expect(rulesOfSearch({ status })).toEqual(['status:invalid_value'])
  })

  it('takes a limit from 1 to 100', () => {
    expect(parseSearch({ limit: 1 }).type).toBe('success')
    expect(parseSearch({ limit: 100 }).type).toBe('success')
    expect(rulesOfSearch({ limit: 0 })).toEqual(['limit:too_small'])
    expect(rulesOfSearch({ limit: 101 })).toEqual(['limit:too_big'])
    expect(rulesOfSearch({ limit: 1.5 })).toEqual(['limit:invalid_type'])
    expect(rulesOfSearch({ limit: '20' })).toEqual(['limit:invalid_type'])
  })

  it.each(['cursor', 'salonId', 'customerId', 'staffId'])(
    'refuses a value of %s that is no ID',
    (property) => {
      const rules = rulesOfSearch({ [property]: 'not-an-id' })

      expect(rules).toHaveLength(1)
      expect(rules[0]).toMatch(new RegExp(`^${property}:`))
    },
  )

  it.each([
    ['a day that does not exist', '2026-02-30'],
    ['a time', '2026-11-20T01:00:00Z'],
    ['another order of the parts', '20/11/2026'],
    ['an empty text', ''],
  ])('refuses %s for a day', (_case, day) => {
    expect(rulesOfSearch({ bookingDateFrom: day })).toEqual([
      'bookingDateFrom:invalid_format',
    ])
    expect(rulesOfSearch({ bookingDateTo: day })).toEqual([
      'bookingDateTo:invalid_format',
    ])
  })

  it('accepts one day as both ends, and either end alone', () => {
    expect(
      parseSearch({
        bookingDateFrom: '2026-11-20',
        bookingDateTo: '2026-11-20',
      }).type,
    ).toBe('success')
    expect(parseSearch({ bookingDateFrom: '2026-11-20' }).type).toBe('success')
    expect(parseSearch({ bookingDateTo: '2026-11-20' }).type).toBe('success')
  })

  it('refuses a last day before the first one', () => {
    expect(
      rulesOfSearch({
        bookingDateFrom: '2026-11-20',
        bookingDateTo: '2026-11-19',
      }),
    ).toEqual(['bookingDateTo:custom'])
  })

  it.each([
    ['a keyword', 'search'],
    ['a page number', 'page'],
    ['a booking number', 'bookingNumber'],
  ])('refuses %s, which the search does not have', (_case, property) => {
    expect(rulesOfSearch({ [property]: 'x' })).toEqual([
      `${property}:unrecognized_keys`,
    ])
  })

  it('refuses null for a condition: one that is not wanted is left out', () => {
    expect(rulesOfSearch({ status: null })).toEqual(['status:invalid_value'])
    expect(rulesOfSearch({ salonId: null })).toHaveLength(1)
  })
})
