import { describe, expect, it } from 'vitest'
import { CUSTOMER_ID } from '../../__tests__/fixtures/auth-fixtures'
import { BOOKING_ID } from '../../__tests__/fixtures/booking-fixtures'
import { brokenRules } from '../../__tests__/fixtures/fixtures'
import {
  POINT_TRANSACTION_ID,
  pointAdjustRequest,
  pointEarnRequest,
  pointUseRequest,
} from '../../__tests__/fixtures/point-fixtures'
import { parseWith, toldIn } from '../../shared'
import {
  pointAdjustRequestSchema,
  pointEarnRequestSchema,
  pointExpireRequestSchema,
  pointExpiringSearchRequestSchema,
  pointTransactionSearchRequestSchema,
  pointUseRequestSchema,
} from '../point.schema'

const rulesBrokenBy = (
  schema: Parameters<typeof parseWith>[0],
  input: unknown,
): string[] => {
  const result = parseWith(schema, input, 'Invalid')
  return result.type === 'error' ? brokenRules(result.error) : []
}

/** What a refused request is told, by `field`. */
const messagesOf = (
  schema: Parameters<typeof parseWith>[0],
  input: unknown,
): Record<string, string> => {
  const result = parseWith(schema, input, 'Invalid')
  return result.type === 'error' && result.error.type === 'validation'
    ? Object.fromEntries(
        result.error.issues.map(({ field, message }) => [
          field,
          toldIn(message, 'en'),
        ]),
      )
    : {}
}

const MAX_INTEGER = 2_147_483_647
const MIN_INTEGER = -2_147_483_648

/** The request without one of its keys. */
const without = (
  request: Record<string, unknown>,
  key: string,
): Record<string, unknown> =>
  Object.fromEntries(Object.entries(request).filter(([name]) => name !== key))

/** What the three requests that move points share, with each of them. */
const movements: [
  string,
  Parameters<typeof parseWith>[0],
  () => Record<string, unknown>,
][] = [
  ['pointEarnRequestSchema', pointEarnRequestSchema, () => pointEarnRequest()],
  ['pointUseRequestSchema', pointUseRequestSchema, () => pointUseRequest()],
  [
    'pointAdjustRequestSchema',
    pointAdjustRequestSchema,
    () =>
      pointAdjustRequest({ referenceType: 'sale', referenceId: BOOKING_ID }),
  ],
]

describe.each(movements)('%s', (_, schema, request) => {
  const moving = (overrides: Record<string, unknown>) => ({
    ...request(),
    ...overrides,
  })

  it('accepts the request and hands it on as it is', () => {
    expect(parseWith(schema, request(), 'Invalid')).toEqual({
      type: 'success',
      data: request(),
    })
  })

  it('accepts no record, and a booking as the record', () => {
    for (const overrides of [
      { referenceType: null, referenceId: null },
      { referenceType: 'booking', referenceId: BOOKING_ID },
    ]) {
      expect(parseWith(schema, moving(overrides), 'Invalid')).toEqual({
        type: 'success',
        data: moving(overrides),
      })
    }
  })

  it.each(Object.keys(request()))('needs the key %s', (key) => {
    // A missing key is not one of the values of an enumeration.
    const rule = key === 'referenceType' ? 'invalid_value' : 'invalid_type'

    expect(rulesBrokenBy(schema, without(request(), key))).toEqual([
      `${key}:${rule}`,
    ])
  })

  it('refuses a key it does not know', () => {
    expect(rulesBrokenBy(schema, moving({ balance: 0 }))).toEqual([
      'balance:unrecognized_keys',
    ])
  })

  it('refuses a customer ID that is not a UUID', () => {
    expect(rulesBrokenBy(schema, moving({ customerId: 'mine' }))).toEqual([
      'customerId:invalid_format',
    ])
  })

  it('refuses a description that is blank, and takes a long one', () => {
    expect(rulesBrokenBy(schema, moving({ description: ' \n' }))).toEqual([
      'description:invalid_format',
    ])
    expect(
      rulesBrokenBy(schema, moving({ description: 'あ'.repeat(10_000) })),
    ).toEqual([])
  })

  it('refuses a kind of record other than a sale or a booking', () => {
    expect(rulesBrokenBy(schema, moving({ referenceType: 'payment' }))).toEqual(
      ['referenceType:invalid_value'],
    )
  })

  it('refuses a record ID that is not a UUID', () => {
    expect(rulesBrokenBy(schema, moving({ referenceId: 'S-1' }))).toEqual([
      'referenceId:invalid_format',
    ])
  })

  it('needs the kind and the ID of a record together', () => {
    expect(rulesBrokenBy(schema, moving({ referenceType: null }))).toEqual([
      'referenceType:custom',
    ])
    expect(messagesOf(schema, moving({ referenceType: null }))).toEqual({
      referenceType: 'Must not be null when referenceId is given',
    })
    expect(rulesBrokenBy(schema, moving({ referenceId: null }))).toEqual([
      'referenceId:custom',
    ])
    expect(messagesOf(schema, moving({ referenceId: null }))).toEqual({
      referenceId: 'Must not be null when referenceType is given',
    })
  })

  it('reports a lone record next to the rules of other properties', () => {
    expect(
      rulesBrokenBy(
        schema,
        moving({
          referenceId: null,
          description: ' ',
          points: MAX_INTEGER + 1,
        }),
      ).toSorted(),
    ).toEqual([
      'description:invalid_format',
      'points:too_big',
      'referenceId:custom',
    ])
  })

  it('refuses points that are not an integer', () => {
    expect(rulesBrokenBy(schema, moving({ points: 1.5 }))).toEqual([
      'points:invalid_type',
    ])
    expect(rulesBrokenBy(schema, moving({ points: '100' }))).toEqual([
      'points:invalid_type',
    ])
  })

  it('takes up to the largest integer of points', () => {
    expect(rulesBrokenBy(schema, moving({ points: MAX_INTEGER }))).toEqual([])
    expect(rulesBrokenBy(schema, moving({ points: MAX_INTEGER + 1 }))).toEqual([
      'points:too_big',
    ])
  })
})

describe.each([
  ['pointEarnRequestSchema', pointEarnRequestSchema, pointEarnRequest],
  ['pointUseRequestSchema', pointUseRequestSchema, pointUseRequest],
])('%s', (_, schema, request) => {
  it('takes one point and no fewer', () => {
    expect(rulesBrokenBy(schema, request({ points: 1 }))).toEqual([])
    expect(rulesBrokenBy(schema, request({ points: 0 }))).toEqual([
      'points:too_small',
    ])
    expect(rulesBrokenBy(schema, request({ points: -1 }))).toEqual([
      'points:too_small',
    ])
  })
})

describe('pointEarnRequestSchema', () => {
  it('takes no expiry date', () => {
    expect(
      rulesBrokenBy(
        pointEarnRequestSchema,
        pointEarnRequest({ expiryDate: null }),
      ),
    ).toEqual([])
  })

  it('refuses an expiry date that is not a date', () => {
    for (const expiryDate of [
      '2027-02-30',
      '2027/11/30',
      '2027-11-30T00:00:00Z',
    ]) {
      expect(
        rulesBrokenBy(pointEarnRequestSchema, pointEarnRequest({ expiryDate })),
      ).toEqual(['expiryDate:invalid_format'])
    }
  })
})

describe.each([
  ['pointUseRequestSchema', pointUseRequestSchema, pointUseRequest()],
  ['pointAdjustRequestSchema', pointAdjustRequestSchema, pointAdjustRequest()],
])('%s', (_, schema, request) => {
  it('has no expiry date', () => {
    expect(
      rulesBrokenBy(schema, { ...request, expiryDate: '2027-11-30' }),
    ).toEqual(['expiryDate:unrecognized_keys'])
  })
})

describe('pointAdjustRequestSchema', () => {
  const adjusting = (points: unknown) => ({ ...pointAdjustRequest(), points })

  it('moves points either way', () => {
    for (const points of [1, -1, MAX_INTEGER, MIN_INTEGER]) {
      expect(
        rulesBrokenBy(pointAdjustRequestSchema, adjusting(points)),
      ).toEqual([])
    }
  })

  it('refuses no points', () => {
    expect(rulesBrokenBy(pointAdjustRequestSchema, adjusting(0))).toEqual([
      'points:custom',
    ])
    expect(messagesOf(pointAdjustRequestSchema, adjusting(0))).toEqual({
      points: 'Must not be 0',
    })
  })

  it('refuses points beyond the integers of the column', () => {
    expect(
      rulesBrokenBy(pointAdjustRequestSchema, adjusting(MAX_INTEGER + 1)),
    ).toEqual(['points:too_big'])
    expect(
      rulesBrokenBy(pointAdjustRequestSchema, adjusting(MIN_INTEGER - 1)),
    ).toEqual(['points:too_small'])
  })
})

describe('pointTransactionSearchRequestSchema', () => {
  const schema = pointTransactionSearchRequestSchema

  it('accepts no parameter', () => {
    expect(parseWith(schema, {}, 'Invalid')).toEqual({
      type: 'success',
      data: {},
    })
  })

  it('accepts every parameter, and writes the times in UTC to the millisecond', () => {
    expect(
      parseWith(
        schema,
        {
          limit: 50,
          cursor: POINT_TRANSACTION_ID,
          startDate: '2026-11-01T00:00:00Z',
          endDate: '2026-11-30T15:00:00.5Z',
        },
        'Invalid',
      ),
    ).toEqual({
      type: 'success',
      data: {
        limit: 50,
        cursor: POINT_TRANSACTION_ID,
        startDate: '2026-11-01T00:00:00.000Z',
        endDate: '2026-11-30T15:00:00.500Z',
      },
    })
  })

  it('refuses every optional key stated as undefined', () => {
    expect(
      rulesBrokenBy(schema, {
        limit: undefined,
        cursor: undefined,
        startDate: undefined,
        endDate: undefined,
      }),
    ).toEqual([
      'limit:invalid_type',
      'cursor:invalid_type',
      'startDate:invalid_type',
      'endDate:invalid_type',
    ])
  })

  it('takes a limit from 1 to 100', () => {
    expect(rulesBrokenBy(schema, { limit: 1 })).toEqual([])
    expect(rulesBrokenBy(schema, { limit: 100 })).toEqual([])
    expect(rulesBrokenBy(schema, { limit: 0 })).toEqual(['limit:too_small'])
    expect(rulesBrokenBy(schema, { limit: 101 })).toEqual(['limit:too_big'])
    expect(rulesBrokenBy(schema, { limit: 2.5 })).toEqual([
      'limit:invalid_type',
    ])
  })

  it('refuses a cursor that is not a UUID', () => {
    expect(rulesBrokenBy(schema, { cursor: 'next' })).toEqual([
      'cursor:invalid_format',
    ])
  })

  it('refuses a time that is not a moment in UTC', () => {
    for (const startDate of ['2026-11-01', '2026-11-01T00:00:00', 'now']) {
      expect(rulesBrokenBy(schema, { startDate })).toEqual([
        'startDate:invalid_format',
      ])
    }
  })

  it('takes an end that is not before the start, and refuses one that is', () => {
    expect(
      rulesBrokenBy(schema, {
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-11-01T00:00:00.000Z',
      }),
    ).toEqual([])
    expect(
      rulesBrokenBy(schema, {
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-10-31T23:59:59.999Z',
      }),
    ).toEqual(['endDate:custom'])
    expect(
      messagesOf(schema, {
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-10-31T23:59:59.999Z',
      }),
    ).toEqual({ endDate: 'Must not be earlier than startDate' })
  })

  it('refuses a parameter it does not know', () => {
    expect(rulesBrokenBy(schema, { customerId: POINT_TRANSACTION_ID })).toEqual(
      ['customerId:unrecognized_keys'],
    )
  })
})

describe('pointExpiringSearchRequestSchema', () => {
  const schema = pointExpiringSearchRequestSchema

  it('accepts no parameter', () => {
    expect(parseWith(schema, {}, 'Invalid')).toEqual({
      type: 'success',
      data: {},
    })
  })

  it('takes a number of days from 1 to 365', () => {
    expect(parseWith(schema, { days: 7 }, 'Invalid')).toEqual({
      type: 'success',
      data: { days: 7 },
    })
    expect(rulesBrokenBy(schema, { days: 1 })).toEqual([])
    expect(rulesBrokenBy(schema, { days: 365 })).toEqual([])
    expect(rulesBrokenBy(schema, { days: 0 })).toEqual(['days:too_small'])
    expect(rulesBrokenBy(schema, { days: 366 })).toEqual(['days:too_big'])
    expect(rulesBrokenBy(schema, { days: 1.5 })).toEqual(['days:invalid_type'])
  })

  it('refuses days stated as undefined', () => {
    expect(rulesBrokenBy(schema, { days: undefined })).toEqual([
      'days:invalid_type',
    ])
  })

  it('refuses a parameter it does not know', () => {
    expect(rulesBrokenBy(schema, { limit: 10 })).toEqual([
      'limit:unrecognized_keys',
    ])
  })
})

describe('pointExpireRequestSchema', () => {
  const schema = pointExpireRequestSchema

  it('accepts a customer and a day, and neither', () => {
    expect(
      parseWith(
        schema,
        { customerId: CUSTOMER_ID, processBefore: '2026-11-01' },
        'Invalid',
      ),
    ).toEqual({
      type: 'success',
      data: { customerId: CUSTOMER_ID, processBefore: '2026-11-01' },
    })
    expect(
      parseWith(schema, { customerId: null, processBefore: null }, 'Invalid'),
    ).toEqual({
      type: 'success',
      data: { customerId: null, processBefore: null },
    })
  })

  it('needs both keys', () => {
    expect(rulesBrokenBy(schema, {})).toEqual([
      'customerId:invalid_type',
      'processBefore:invalid_type',
    ])
  })

  it('refuses a customer ID that is not a UUID and a day that is not a date', () => {
    expect(
      rulesBrokenBy(schema, {
        customerId: 'everyone',
        processBefore: '2026-11-01T00:00:00Z',
      }),
    ).toEqual(['customerId:invalid_format', 'processBefore:invalid_format'])
    expect(
      rulesBrokenBy(schema, { customerId: null, processBefore: '2026-02-30' }),
    ).toEqual(['processBefore:invalid_format'])
  })

  it('refuses a key it does not know', () => {
    expect(
      rulesBrokenBy(schema, {
        customerId: null,
        processBefore: null,
        salonId: CUSTOMER_ID,
      }),
    ).toEqual(['salonId:unrecognized_keys'])
  })
})
