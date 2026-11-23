import {
  bookingMessages,
  ruleMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import { CUSTOMER_ID } from '../../__tests__/fixtures/auth-fixtures'
import {
  BOOKING_ID,
  bookingCreateRequest,
  COLOR_ID,
  CUT_ID,
} from '../../__tests__/fixtures/booking-fixtures'
import { brokenRules, SALON_ID } from '../../__tests__/fixtures/fixtures'
import { STAFF_MEMBER_ID } from '../../__tests__/fixtures/staff-fixtures'
import { parseWith } from '../../shared'
import {
  bookingCancelRequestSchema,
  bookingCompleteRequestSchema,
  bookingCreateRequestSchema,
  bookingRescheduleRequestSchema,
  bookingSearchRequestSchema,
  bookingUpdateRequestSchema,
  customerBookingCreateRequestSchema,
  customerBookingSearchRequestSchema,
} from '../booking.schema'

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

const parseUpdate = (input: unknown) =>
  parseWith(bookingUpdateRequestSchema, input, 'Invalid')

const rulesOfUpdate = (input: unknown): string[] =>
  rulesBrokenBy(bookingUpdateRequestSchema, input)

const parseReschedule = (input: unknown) =>
  parseWith(bookingRescheduleRequestSchema, input, 'Invalid')

const rulesOfReschedule = (input: unknown): string[] =>
  rulesBrokenBy(bookingRescheduleRequestSchema, input)

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
            message: bookingMessages.withinHoursOfEarliest(24),
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

describe('bookingUpdateRequestSchema', () => {
  const noted = {
    depositAmount: 3000,
    customerRequest: '短めに',
    internalNotes: 'お子様連れ',
    source: 'web',
  }

  it('accepts every property at once and returns them as they were written', () => {
    const request = { ...noted, customerRequest: '  短めに  ' }

    expect(parseUpdate(request)).toStrictEqual({
      type: 'success',
      data: request,
    })
  })

  it.each(Object.entries(noted))(
    'accepts %s alone and returns no other property',
    (property, value) => {
      expect(parseUpdate({ [property]: value })).toStrictEqual({
        type: 'success',
        data: { [property]: value },
      })
    },
  )

  it.each(Object.keys(noted))(
    'accepts null for %s, which empties it',
    (property) => {
      expect(parseUpdate({ [property]: null })).toStrictEqual({
        type: 'success',
        data: { [property]: null },
      })
    },
  )

  it.each(Object.keys(noted))(
    'refuses %s that is stated as undefined: a property is there with a value or it is not there',
    (property) => {
      expect(rulesOfUpdate({ ...noted, [property]: undefined })).toEqual([
        `${property}:invalid_type`,
      ])
    },
  )

  it('refuses a request that states nothing, with one error for the request as a whole', () => {
    expect(rulesOfUpdate({})).toEqual([':custom'])
    expect(parseUpdate({})).toMatchObject({
      type: 'error',
      error: {
        issues: [{ message: ruleMessages.atLeastOneProperty }],
      },
    })
  })

  it.each([
    ['nothing', 0],
    ['the largest amount of the column', 2_147_483_647],
  ])('accepts a deposit of %s', (_case, depositAmount) => {
    expect(parseUpdate({ depositAmount }).type).toBe('success')
  })

  it.each([
    ['a negative amount', { depositAmount: -1 }, 'depositAmount:too_small'],
    [
      'a fraction of a yen',
      { depositAmount: 1000.5 },
      'depositAmount:invalid_type',
    ],
    [
      'more than the column holds',
      { depositAmount: 2_147_483_648 },
      'depositAmount:too_big',
    ],
    [
      'an amount as text',
      { depositAmount: '1000' },
      'depositAmount:invalid_type',
    ],
    [
      'a request of the customer that says nothing',
      { customerRequest: '' },
      'customerRequest:invalid_format',
    ],
    [
      'notes that are spaces',
      { internalNotes: ' \t\n' },
      'internalNotes:invalid_format',
    ],
    ['a source that says nothing', { source: '' }, 'source:invalid_format'],
    ['a source of 51 characters', { source: 'a'.repeat(51) }, 'source:too_big'],
    [
      'notes that are a number',
      { internalNotes: 1 },
      'internalNotes:invalid_type',
    ],
  ])('refuses %s, as a create request does', (_case, change, rule) => {
    expect(rulesOfUpdate(change)).toEqual([rule])
  })

  it('keeps the source within the 50 characters of its column, and sets no limit to the notes', () => {
    expect(parseUpdate({ source: 'a'.repeat(50) }).type).toBe('success')
    expect(
      parseUpdate({
        customerRequest: 'x'.repeat(10_000),
        internalNotes: 'x'.repeat(10_000),
      }).type,
    ).toBe('success')
  })

  it.each([
    ['the status, which the actions change', 'status', 'confirmed'],
    [
      'the time, which a reschedule changes',
      'startTime',
      '2026-11-21T05:00:00Z',
    ],
    ['the staff member, whom a reschedule changes', 'staffId', STAFF_MEMBER_ID],
    ['the salon', 'salonId', SALON_ID],
    ['the customer', 'customerId', CUSTOMER_ID],
    ['the service lines', 'services', []],
    ['the booking number', 'bookingNumber', 'BK-0000-0001'],
    ['the total', 'totalAmount', 0],
    ['the fee of a cancellation', 'cancellationFee', 500],
    ['the points', 'pointsUsed', 10],
    ['the ID', 'id', BOOKING_ID],
  ])('refuses %s', (_case, property, value) => {
    expect(rulesOfUpdate({ ...noted, [property]: value })).toEqual([
      `${property}:unrecognized_keys`,
    ])
  })

  it('reports an unknown property as such, not as a request that states nothing', () => {
    expect(rulesOfUpdate({ status: 'confirmed' })).toEqual([
      'status:unrecognized_keys',
    ])
  })

  it('reports every broken rule at once', () => {
    expect(
      rulesOfUpdate({
        depositAmount: -1,
        customerRequest: '',
        internalNotes: 3,
        source: 'a'.repeat(51),
        status: 'confirmed',
      }).toSorted(),
    ).toEqual([
      'customerRequest:invalid_format',
      'depositAmount:too_small',
      'internalNotes:invalid_type',
      'source:too_big',
      'status:unrecognized_keys',
    ])
  })

  it.each([
    ['a list', [noted]],
    ['a text', 'booking'],
    ['null', null],
    ['nothing', undefined],
  ])('refuses %s for a request', (_case, input) => {
    expect(rulesOfUpdate(input)).toEqual([':invalid_type'])
  })
})

describe('bookingRescheduleRequestSchema', () => {
  /** A request that moves the booking to this time. */
  const movingTo = (startTime: unknown) => ({
    startTime,
    staffId: STAFF_MEMBER_ID,
  })

  it('accepts a time and a staff member, and spells the time in one way', () => {
    expect(parseReschedule(movingTo('2026-11-21T05:00:00Z'))).toStrictEqual({
      type: 'success',
      data: {
        startTime: '2026-11-21T05:00:00.000Z',
        staffId: STAFF_MEMBER_ID,
      },
    })
  })

  it('returns the ID of the staff member in lower case', () => {
    expect(
      parseReschedule({
        startTime: '2026-11-21T05:00:00.000Z',
        staffId: STAFF_MEMBER_ID.toUpperCase(),
      }),
    ).toMatchObject({ type: 'success', data: { staffId: STAFF_MEMBER_ID } })
  })

  it.each([
    ['with a fraction of zero', '2026-11-21T05:00:00.000Z'],
    ['at midnight', '2026-11-21T00:00:00Z'],
    ['in the last minute of a day', '2026-11-21T23:59:00Z'],
    [
      'that has passed: what was not entered in time is entered afterwards',
      '2020-01-01T01:00:00Z',
    ],
  ])('accepts a time in UTC on a whole minute %s', (_case, startTime) => {
    expect(parseReschedule(movingTo(startTime)).type).toBe('success')
  })

  it.each([
    ['seconds', '2026-11-21T05:00:30Z'],
    ['a fraction of a second', '2026-11-21T05:00:00.500Z'],
  ])(
    'refuses a time with %s: a booking is made to the minute',
    (_case, startTime) => {
      expect(rulesOfReschedule(movingTo(startTime))).toEqual([
        'startTime:custom',
      ])
      expect(parseReschedule(movingTo(startTime))).toMatchObject({
        type: 'error',
        error: { issues: [{ message: bookingMessages.wholeMinute }] },
      })
    },
  )

  it.each([
    ['an offset', '2026-11-21T14:00:00+09:00'],
    ['no time zone', '2026-11-21T05:00:00'],
    ['no seconds', '2026-11-21T05:00Z'],
    ['a date only', '2026-11-21'],
    ['a day that does not exist', '2026-02-30T05:00:00Z'],
    ['a number', 1_795_000_000_000],
    ['an empty text', ''],
    ['null', null],
  ])(
    'refuses a time that is not a UTC time of ISO 8601: %s',
    (_case, startTime) => {
      const rules = rulesOfReschedule(movingTo(startTime))

      expect(rules).toHaveLength(1)
      expect(rules[0]).toMatch(/^startTime:invalid_/)
    },
  )

  it.each([
    ['a text that is no ID', 'somebody'],
    ['nobody: a booking has one staff member in charge', null],
    ['a number', 1],
  ])('refuses %s for the staff member', (_case, staffId) => {
    const rules = rulesOfReschedule({
      startTime: '2026-11-21T05:00:00Z',
      staffId,
    })

    expect(rules).toHaveLength(1)
    expect(rules[0]).toMatch(/^staffId:invalid_/)
  })

  it.each(['startTime', 'staffId'])(
    'requires %s: a move says when and with whom',
    (property) => {
      const { [property]: _omitted, ...request }: Record<string, unknown> =
        movingTo('2026-11-21T05:00:00Z')

      expect(rulesOfReschedule(request)).toEqual([`${property}:invalid_type`])
    },
  )

  it.each([
    [
      'the end, which follows from the start',
      'endTime',
      '2026-11-21T07:30:00Z',
    ],
    ['the day of the visit', 'bookingDate', '2026-11-21'],
    ['the status', 'status', 'confirmed'],
    ['the service lines', 'services', []],
    ['a reason', 'reason', 'お客様のご都合'],
    ['the salon', 'salonId', SALON_ID],
  ])('refuses %s', (_case, property, value) => {
    expect(
      rulesOfReschedule({
        ...movingTo('2026-11-21T05:00:00Z'),
        [property]: value,
      }),
    ).toEqual([`${property}:unrecognized_keys`])
  })

  it('reports every broken rule at once', () => {
    expect(
      rulesOfReschedule({
        startTime: '2026-11-21T05:00:30Z',
        staffId: 'somebody',
        status: 'confirmed',
      }).toSorted(),
    ).toEqual([
      'staffId:invalid_format',
      'startTime:custom',
      'status:unrecognized_keys',
    ])
  })

  it.each([
    ['a list', []],
    ['a text', 'booking'],
    ['null', null],
    ['nothing', undefined],
  ])('refuses %s for a request', (_case, input) => {
    expect(rulesOfReschedule(input)).toEqual([':invalid_type'])
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
            message: bookingMessages.afterActualStartTime,
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

  it('should say that a last day before the first one is earlier than bookingDateFrom', () => {
    // Arrange
    const search = {
      bookingDateFrom: '2026-11-20',
      bookingDateTo: '2026-11-19',
    }

    // Act
    const result = parseSearch(search)

    // Assert
    expect(result).toMatchObject({
      type: 'error',
      error: {
        issues: [{ message: ruleMessages.notEarlierThan('bookingDateFrom') }],
      },
    })
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

describe('customerBookingCreateRequestSchema', () => {
  const parseOwn = (input: unknown) =>
    parseWith(customerBookingCreateRequestSchema, input, 'Invalid')
  const rulesOfOwn = (input: unknown): string[] =>
    rulesBrokenBy(customerBookingCreateRequestSchema, input)

  /** A request that satisfies every rule. */
  const wanting = (overrides: Record<string, unknown> = {}) => ({
    salonId: SALON_ID,
    serviceId: CUT_ID,
    staffId: STAFF_MEMBER_ID,
    startTime: '2026-11-20T01:00:00.000Z',
    customerRequest: null,
    ...overrides,
  })

  it('accepts a slot of a service with a staff member of a salon and returns it unchanged', () => {
    expect(parseOwn(wanting())).toEqual({ type: 'success', data: wanting() })
    expect(parseOwn(wanting({ customerRequest: '静かな席で' }))).toEqual({
      type: 'success',
      data: wanting({ customerRequest: '静かな席で' }),
    })
  })

  it.each(['salonId', 'serviceId', 'staffId', 'startTime', 'customerRequest'])(
    'refuses a request without %s',
    (property) => {
      expect(rulesOfOwn(wanting({ [property]: undefined }))).toEqual([
        `${property}:invalid_type`,
      ])
    },
  )

  it.each(['salonId', 'serviceId', 'staffId'])(
    'refuses a value of %s that is no ID, and null',
    (property) => {
      expect(rulesOfOwn(wanting({ [property]: 'not-an-id' }))).toEqual([
        `${property}:invalid_format`,
      ])
      expect(rulesOfOwn(wanting({ [property]: null }))).toEqual([
        `${property}:invalid_type`,
      ])
    },
  )

  it('returns the time in the one spelling of its moment', () => {
    const result = parseOwn(wanting({ startTime: '2026-11-20T01:00:00Z' }))

    expect(result).toMatchObject({
      type: 'success',
      data: { startTime: '2026-11-20T01:00:00.000Z' },
    })
  })

  it.each([
    ['a time with an offset', '2026-11-20T10:00:00+09:00', 'invalid_format'],
    ['a time without a zone', '2026-11-20T10:00:00', 'invalid_format'],
    ['a date', '2026-11-20', 'invalid_format'],
    ['a word', 'tomorrow', 'invalid_format'],
    ['a time with seconds', '2026-11-20T01:00:30Z', 'custom'],
    [
      'a time with a fraction of a second',
      '2026-11-20T01:00:00.500Z',
      'custom',
    ],
  ])('refuses %s', (_case, startTime, rule) => {
    expect(rulesOfOwn(wanting({ startTime }))).toEqual([`startTime:${rule}`])
  })

  it.each([
    ['an empty request of the customer', ''],
    ['a request of spaces', ' \n '],
  ])('refuses %s: no request is null', (_case, customerRequest) => {
    expect(rulesOfOwn(wanting({ customerRequest }))).toEqual([
      'customerRequest:invalid_format',
    ])
  })

  it.each([
    ['the customer, who is the account', 'customerId', CUSTOMER_ID],
    ['a deposit', 'depositAmount', 1000],
    ['a note of the salon', 'internalNotes', 'VIP'],
    ['where the booking came from', 'source', 'phone'],
    ['a list of services', 'services', []],
    ['a status', 'status', 'confirmed'],
    ['a duration', 'duration', 30],
    ['an end', 'endTime', '2026-11-20T02:00:00.000Z'],
  ])('refuses %s, which a customer does not send', (_case, property, value) => {
    expect(rulesOfOwn(wanting({ [property]: value }))).toEqual([
      `${property}:unrecognized_keys`,
    ])
  })

  it.each([
    ['null', null],
    ['a list', []],
    ['a text', 'a cut at ten'],
  ])('refuses %s for a request', (_case, input) => {
    expect(rulesOfOwn(input)).toEqual([':invalid_type'])
  })
})

describe('customerBookingSearchRequestSchema', () => {
  const parseOwnSearch = (input: unknown) =>
    parseWith(customerBookingSearchRequestSchema, input, 'Invalid')
  const rulesOfOwnSearch = (input: unknown): string[] =>
    rulesBrokenBy(customerBookingSearchRequestSchema, input)

  it('accepts a search without a condition', () => {
    expect(parseOwnSearch({})).toEqual({ type: 'success', data: {} })
  })

  it('accepts every condition together and returns the search unchanged', () => {
    const search = {
      limit: 50,
      cursor: BOOKING_ID,
      status: 'confirmed',
      bookingDateFrom: '2026-11-01',
      bookingDateTo: '2026-11-30',
    }

    expect(parseOwnSearch(search)).toEqual({ type: 'success', data: search })
  })

  it.each(['salonId', 'customerId', 'staffId'])(
    'refuses %s, by which the ledger is searched and a customer’s own bookings are not',
    (property) => {
      expect(rulesOfOwnSearch({ [property]: SALON_ID })).toEqual([
        `${property}:unrecognized_keys`,
      ])
    },
  )

  it('holds what it has to the rules of the search of the ledger', () => {
    const searches: Record<string, unknown>[] = [
      { limit: 0 },
      { limit: 101 },
      { limit: '20' },
      { cursor: 'first' },
      { status: 'done' },
      { status: null },
      { bookingDateFrom: '2026-02-30' },
      { bookingDateTo: '20/11/2026' },
      { bookingDateFrom: '2026-11-20', bookingDateTo: '2026-11-19' },
      { bookingDateFrom: '2026-11-20', bookingDateTo: '2026-11-20' },
      { limit: 1, status: 'no_show' },
      { page: 2 },
    ]

    expect(searches.map(rulesOfOwnSearch)).toEqual(searches.map(rulesOfSearch))
    expect(searches.map(rulesOfOwnSearch)).toEqual([
      ['limit:too_small'],
      ['limit:too_big'],
      ['limit:invalid_type'],
      ['cursor:invalid_format'],
      ['status:invalid_value'],
      ['status:invalid_value'],
      ['bookingDateFrom:invalid_format'],
      ['bookingDateTo:invalid_format'],
      ['bookingDateTo:custom'],
      [],
      [],
      ['page:unrecognized_keys'],
    ])
  })
})
