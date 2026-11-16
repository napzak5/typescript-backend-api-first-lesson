import { describe, expect, it } from 'vitest'
import {
  dailySalesGetRequestSchema,
  MAX_REPORT_DAYS,
  salesReportGetRequestSchema,
  salesTrendsGetRequestSchema,
} from '../schemas/sales-report.schema'
import { parseWith } from '../shared'
import { brokenRules, SALON_ID } from './fixtures'
import { periodQuery } from './sales-report-fixtures'

const rulesBrokenBy = (
  schema: Parameters<typeof parseWith>[0],
  input: unknown,
): string[] => {
  const result = parseWith(schema, input, 'Invalid')
  return result.type === 'error' ? brokenRules(result.error) : []
}

const parseReport = (input: unknown) =>
  parseWith(salesReportGetRequestSchema, input, 'Invalid')

const rulesOfReport = (input: unknown): string[] =>
  rulesBrokenBy(salesReportGetRequestSchema, input)

const rulesOfTrends = (input: unknown): string[] =>
  rulesBrokenBy(salesTrendsGetRequestSchema, input)

const rulesOfDaily = (input: unknown): string[] =>
  rulesBrokenBy(dailySalesGetRequestSchema, input)

/** The messages of a failed validation of a report, by `field`. */
const messagesOf = (input: unknown): Record<string, string> => {
  const result = parseReport(input)
  return result.type === 'error' && result.error.type === 'validation'
    ? Object.fromEntries(
        result.error.issues.map(({ field, message }) => [field, message]),
      )
    : {}
}

describe('salesReportGetRequestSchema', () => {
  it('takes a salon and the first and the last day of the sales', () => {
    expect(parseReport(periodQuery())).toEqual({
      type: 'success',
      data: {
        salonId: SALON_ID,
        startDate: '2026-11-01',
        endDate: '2026-11-30',
      },
    })
  })

  it('takes one day as both ends', () => {
    expect(
      parseReport(
        periodQuery({ startDate: '2026-11-20', endDate: '2026-11-20' }),
      ).type,
    ).toBe('success')
  })

  it.each(['salonId', 'startDate', 'endDate'])(
    'refuses a query without %s: a report has no default period',
    (property) => {
      expect(rulesOfReport(periodQuery({ [property]: undefined }))).toEqual([
        `${property}:invalid_type`,
      ])
    },
  )

  it('refuses a query without anything, and names everything that is missing', () => {
    expect(rulesOfReport({})).toEqual([
      'salonId:invalid_type',
      'startDate:invalid_type',
      'endDate:invalid_type',
    ])
  })

  it('refuses a salon that is no ID', () => {
    expect(rulesOfReport(periodQuery({ salonId: 'not-an-id' }))).toEqual([
      'salonId:invalid_format',
    ])
  })

  it.each([
    ['a day that does not exist', '2026-02-29'],
    ['a time', '2026-11-20T03:40:00Z'],
    ['another order of the parts', '20/11/2026'],
    ['an empty text', ''],
  ])('refuses %s for a day, and does not compare it', (_case, day) => {
    expect(rulesOfReport(periodQuery({ startDate: day }))).toEqual([
      'startDate:invalid_format',
    ])
    expect(rulesOfReport(periodQuery({ endDate: day }))).toEqual([
      'endDate:invalid_format',
    ])
  })

  it('refuses a parameter given twice, which comes as a list', () => {
    expect(
      rulesOfReport(periodQuery({ startDate: ['2026-11-01', '2026-11-02'] })),
    ).toEqual(['startDate:invalid_type'])
  })

  it.each(['period', 'staffId', 'limit', 'date'])(
    'refuses %s, which the report does not have',
    (property) => {
      expect(rulesOfReport(periodQuery({ [property]: 'x' }))).toEqual([
        `${property}:unrecognized_keys`,
      ])
    },
  )

  it('refuses a last day before the first one, and says so', () => {
    const query = periodQuery({
      startDate: '2026-11-20',
      endDate: '2026-11-19',
    })

    expect(rulesOfReport(query)).toEqual(['endDate:custom'])
    expect(messagesOf(query)).toEqual({
      endDate: 'Must not be earlier than startDate',
    })
  })

  it(`takes a period of ${MAX_REPORT_DAYS} days, both ends included`, () => {
    expect(
      parseReport(
        periodQuery({ startDate: '2025-11-17', endDate: '2026-11-17' }),
      ).type,
    ).toBe('success')
    expect(
      parseReport(
        periodQuery({ startDate: '2028-01-01', endDate: '2028-12-31' }),
      ).type,
    ).toBe('success')
  })

  it('refuses a period of one day more, and says so', () => {
    const query = periodQuery({
      startDate: '2025-11-17',
      endDate: '2026-11-18',
    })

    expect(rulesOfReport(query)).toEqual(['endDate:custom'])
    expect(messagesOf(query)).toEqual({
      endDate: 'Must be within 366 days of startDate, both included',
    })
  })

  it('counts the 29th of February of a leap year in a period', () => {
    expect(
      rulesOfReport(
        periodQuery({ startDate: '2027-03-01', endDate: '2028-03-01' }),
      ),
    ).toEqual(['endDate:custom'])
    expect(
      rulesOfReport(
        periodQuery({ startDate: '2027-03-02', endDate: '2028-03-01' }),
      ),
    ).toEqual([])
  })

  it('reports a salon that is no ID together with dates out of order', () => {
    expect(
      rulesOfReport(
        periodQuery({
          salonId: 'not-an-id',
          startDate: '2026-11-20',
          endDate: '2026-11-19',
        }),
      ),
    ).toEqual(['salonId:invalid_format', 'endDate:custom'])
  })
})

describe('salesTrendsGetRequestSchema', () => {
  it.each(['daily', 'weekly', 'monthly'])(
    'takes a period cut by %s',
    (period) => {
      expect(rulesOfTrends(periodQuery({ period }))).toEqual([])
    },
  )

  it('refuses a trend without a unit: there is no default', () => {
    expect(rulesOfTrends(periodQuery())).toEqual(['period:invalid_value'])
  })

  it.each(['yearly', 'DAILY', ''])('refuses %j for a unit', (period) => {
    expect(rulesOfTrends(periodQuery({ period }))).toEqual([
      'period:invalid_value',
    ])
  })

  it('holds a period to the rules of a report', () => {
    expect(
      rulesOfTrends(
        periodQuery({
          period: 'daily',
          startDate: '2026-11-20',
          endDate: '2026-11-19',
        }),
      ),
    ).toEqual(['endDate:custom'])
    expect(
      rulesOfTrends(
        periodQuery({
          period: 'monthly',
          startDate: '2025-11-17',
          endDate: '2026-11-18',
        }),
      ),
    ).toEqual(['endDate:custom'])
  })
})

describe('dailySalesGetRequestSchema', () => {
  const dayQuery = (overrides: Record<string, unknown> = {}) => ({
    salonId: SALON_ID,
    date: '2026-11-20',
    ...overrides,
  })

  it('takes a salon and a day', () => {
    expect(rulesOfDaily(dayQuery())).toEqual([])
  })

  it.each(['salonId', 'date'])('refuses a query without %s', (property) => {
    expect(rulesOfDaily(dayQuery({ [property]: undefined }))).toEqual([
      `${property}:invalid_type`,
    ])
  })

  it('refuses a day that does not exist', () => {
    expect(rulesOfDaily(dayQuery({ date: '2026-11-31' }))).toEqual([
      'date:invalid_format',
    ])
  })

  it.each(['startDate', 'endDate'])(
    'refuses %s: the sales of a day are of one day',
    (property) => {
      expect(rulesOfDaily(dayQuery({ [property]: '2026-11-20' }))).toEqual([
        `${property}:unrecognized_keys`,
      ])
    },
  )
})
