import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import {
  GetDailySalesUseCase,
  GetSalesByCategoryUseCase,
  GetSalesByStaffUseCase,
  GetSalesReportUseCase,
  GetSalesTrendsUseCase,
  type SalesReportUseCaseDependencies,
} from '../business-logic/sales-report'
import type { Actor } from '../models/auth'
import { type DomainError, DomainErrors } from '../shared'
import { actors } from './auth-fixtures'
import { brokenRules, OTHER_SALON_ID, SALON_ID } from './fixtures'
import {
  periodQuery,
  salesFigures,
  salesPeriod,
  salesReportDependencies,
} from './sales-report-fixtures'
import { OTHER_STAFF_MEMBER_ID, STAFF_MEMBER_ID } from './staff-fixtures'

const forbidden = Result.error(DomainErrors.forbidden())
const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

const findFiguresOf = ({
  salesReportRepository,
}: SalesReportUseCaseDependencies) =>
  vi.mocked(salesReportRepository.findFigures)

type Report = {
  name: string
  message: string
  /** A query the report takes, for the salon of the fixtures. */
  query: (overrides?: Record<string, unknown>) => Record<string, unknown>
  /** A query the report refuses for itself, with the rule it breaks. */
  wrongQuery: [Record<string, unknown>, string]
  run: (
    dependencies: SalesReportUseCaseDependencies,
    actor: Actor,
    query: unknown,
  ) => Promise<Result<unknown, DomainError>>
}

const dayQuery = (overrides: Record<string, unknown> = {}) => ({
  salonId: SALON_ID,
  date: '2026-11-20',
  ...overrides,
})

const reports: Report[] = [
  {
    name: 'the report of a period',
    message: 'Invalid sales report',
    query: periodQuery,
    wrongQuery: [
      periodQuery({ startDate: '2026-11-20', endDate: '2026-11-19' }),
      'endDate:custom',
    ],
    run: (dependencies, actor, query) =>
      new GetSalesReportUseCase(dependencies).execute(actor, query),
  },
  {
    name: 'the sales of a day',
    message: 'Invalid daily sales',
    query: dayQuery,
    wrongQuery: [dayQuery({ date: '2026-11-31' }), 'date:invalid_format'],
    run: (dependencies, actor, query) =>
      new GetDailySalesUseCase(dependencies).execute(actor, query),
  },
  {
    name: 'the sales by staff member',
    message: 'Invalid sales report',
    query: periodQuery,
    wrongQuery: [
      periodQuery({ startDate: '2025-11-17', endDate: '2026-11-18' }),
      'endDate:custom',
    ],
    run: (dependencies, actor, query) =>
      new GetSalesByStaffUseCase(dependencies).execute(actor, query),
  },
  {
    name: 'the sales by category',
    message: 'Invalid sales report',
    query: periodQuery,
    wrongQuery: [periodQuery({ endDate: undefined }), 'endDate:invalid_type'],
    run: (dependencies, actor, query) =>
      new GetSalesByCategoryUseCase(dependencies).execute(actor, query),
  },
  {
    name: 'the trends of the sales',
    message: 'Invalid sales trends',
    query: (overrides = {}) => periodQuery({ period: 'weekly', ...overrides }),
    wrongQuery: [periodQuery({ period: 'yearly' }), 'period:invalid_value'],
    run: (dependencies, actor, query) =>
      new GetSalesTrendsUseCase(dependencies).execute(actor, query),
  },
]

/** Those who read the reports of the salon of the fixtures. */
const readers: [string, Actor][] = [
  ['an admin', actors.admin],
  ['the owner of the salon', actors.ofSalon('owner')],
  ['the manager of the salon', actors.ofSalon('manager')],
]

/** Those who read no report. */
const notReaders: [string, Actor][] = [
  ['the staff of the salon', actors.ofSalon('staff')],
  ['a customer', actors.customer],
  ['a customer without a profile', actors.customerWithoutProfile],
  ['an account of a salon that reaches no salon', actors.withoutScope],
]

/** The owner and the manager of another salon than the one of the fixtures. */
const runnersOfAnotherSalon: [string, Actor][] = [
  ['the owner of another salon', actors.ofSalon('owner', OTHER_SALON_ID)],
  ['the manager of another salon', actors.ofSalon('manager', OTHER_SALON_ID)],
]

describe.each(reports)('$name', (report) => {
  it.each(readers)('is read by %s', async (_who, actor) => {
    const dependencies = salesReportDependencies()

    const result = await report.run(dependencies, actor, report.query())

    expect(result.type).toBe('success')
    expect(findFiguresOf(dependencies)).toHaveBeenCalledTimes(1)
  })

  it.each(notReaders)(
    'is refused to %s before the query is read, whatever it says',
    async (_who, actor) => {
      const dependencies = salesReportDependencies()

      expect(await report.run(dependencies, actor, report.query())).toEqual(
        forbidden,
      )
      expect(await report.run(dependencies, actor, { anything: 1 })).toEqual(
        forbidden,
      )
      expect(findFiguresOf(dependencies)).not.toHaveBeenCalled()
    },
  )

  it.each(runnersOfAnotherSalon)(
    'is refused to %s, without looking the salon up',
    async (_who, actor) => {
      const dependencies = salesReportDependencies()

      expect(await report.run(dependencies, actor, report.query())).toEqual(
        forbidden,
      )
      expect(findFiguresOf(dependencies)).not.toHaveBeenCalled()
    },
  )

  it('tells the owner of another salon what is wrong with a query, before which salon it names', async () => {
    const dependencies = salesReportDependencies()
    const [query, rule] = report.wrongQuery

    const result = await report.run(
      dependencies,
      actors.ofSalon('owner', OTHER_SALON_ID),
      query,
    )

    expect(rulesOf(result)).toEqual([rule])
    expect(findFiguresOf(dependencies)).not.toHaveBeenCalled()
  })

  it('refuses a query it does not take, under its own message', async () => {
    const dependencies = salesReportDependencies()
    const [query, rule] = report.wrongQuery

    const result = await report.run(dependencies, actors.admin, query)

    expect(result).toMatchObject({
      type: 'error',
      error: { type: 'validation', message: report.message },
    })
    expect(rulesOf(result)).toEqual([rule])
    expect(findFiguresOf(dependencies)).not.toHaveBeenCalled()
  })

  it('refuses a parameter it does not have', async () => {
    const dependencies = salesReportDependencies()

    const result = await report.run(
      dependencies,
      actors.admin,
      report.query({ customerId: SALON_ID }),
    )

    expect(rulesOf(result)).toEqual(['customerId:unrecognized_keys'])
    expect(findFiguresOf(dependencies)).not.toHaveBeenCalled()
  })

  it('refuses a query that is not one', async () => {
    const dependencies = salesReportDependencies()

    expect(rulesOf(await report.run(dependencies, actors.admin, null))).toEqual(
      [':invalid_type'],
    )
    expect(findFiguresOf(dependencies)).not.toHaveBeenCalled()
  })

  it('tells that the salon is not there as a rule of the query, under its own message', async () => {
    const dependencies = salesReportDependencies(Result.success(null))

    const result = await report.run(dependencies, actors.admin, report.query())

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'validation',
        message: report.message,
        issues: [
          {
            field: 'salonId',
            rule: 'not_found',
            message: 'Must name a salon',
          },
        ],
      },
    })
  })

  it('passes on a failure of the database', async () => {
    const dependencies = salesReportDependencies(databaseDown)

    expect(
      await report.run(dependencies, actors.ofSalon('owner'), report.query()),
    ).toEqual(databaseDown)
  })
})

describe('GetSalesReportUseCase', () => {
  it('reads the figures of the period named, and reports them', async () => {
    const dependencies = salesReportDependencies()

    const result = await new GetSalesReportUseCase(dependencies).execute(
      actors.ofSalon('manager'),
      periodQuery(),
    )

    expect(findFiguresOf(dependencies).mock.calls).toEqual([[salesPeriod()]])
    expect(result).toMatchObject({
      type: 'success',
      data: {
        salonId: SALON_ID,
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        totalSales: 44000,
        totalRefunds: 2000,
        netSales: 42000,
        transactionCount: 3,
      },
    })
  })
})

describe('GetDailySalesUseCase', () => {
  it('reads the figures of that day alone, and reports it', async () => {
    const dependencies = salesReportDependencies()

    const result = await new GetDailySalesUseCase(dependencies).execute(
      actors.admin,
      dayQuery(),
    )

    expect(findFiguresOf(dependencies).mock.calls).toEqual([
      [salesPeriod({ startDate: '2026-11-20', endDate: '2026-11-20' })],
    ])
    expect(result).toEqual({
      type: 'success',
      data: {
        date: '2026-11-20',
        sales: 33000,
        transactions: 2,
        refunds: 2000,
        net: 31000,
      },
    })
  })
})

describe('GetSalesByStaffUseCase', () => {
  it('lists every staff member of the period, not only the first of them', async () => {
    const staff = Array.from({ length: 7 }, (_, index) => ({
      staffId: `0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f0${index}`,
      displayName: `Staff ${index}`,
      totalSales: 1000 * (index + 1),
      serviceSales: 0,
      serviceCount: 0,
    }))
    const dependencies = salesReportDependencies(
      Result.success(salesFigures({ staff })),
    )

    const result = await new GetSalesByStaffUseCase(dependencies).execute(
      actors.ofSalon('owner'),
      periodQuery(),
    )

    expect(result.type === 'success' ? result.data : []).toHaveLength(7)
    expect(findFiguresOf(dependencies).mock.calls).toEqual([[salesPeriod()]])
  })

  it('reports the staff members of the fixtures, the most first', async () => {
    const result = await new GetSalesByStaffUseCase(
      salesReportDependencies(),
    ).execute(actors.admin, periodQuery())

    expect(
      result.type === 'success'
        ? result.data.map(({ staffId }) => staffId)
        : [],
    ).toEqual([OTHER_STAFF_MEMBER_ID, STAFF_MEMBER_ID])
  })
})

describe('GetSalesByCategoryUseCase', () => {
  it('reports the kinds of category of the period', async () => {
    const dependencies = salesReportDependencies()

    const result = await new GetSalesByCategoryUseCase(dependencies).execute(
      actors.admin,
      periodQuery(),
    )

    expect(findFiguresOf(dependencies).mock.calls).toEqual([[salesPeriod()]])
    expect(result).toEqual({
      type: 'success',
      data: [
        { category: 'color', amount: 22000, count: 1, percentage: 50 },
        { category: 'cut', amount: 22000, count: 2, percentage: 50 },
      ],
    })
  })
})

describe('GetSalesTrendsUseCase', () => {
  it('reads the figures of the period without its unit, and cuts them by it', async () => {
    const dependencies = salesReportDependencies()

    const result = await new GetSalesTrendsUseCase(dependencies).execute(
      actors.ofSalon('owner'),
      periodQuery({ period: 'weekly' }),
    )

    expect(findFiguresOf(dependencies).mock.calls).toEqual([[salesPeriod()]])
    expect(result).toEqual({
      type: 'success',
      data: {
        labels: [
          '2026-10-26',
          '2026-11-02',
          '2026-11-09',
          '2026-11-16',
          '2026-11-23',
          '2026-11-30',
        ],
        sales: [0, 0, 0, 44000, 0, 0],
        transactions: [0, 0, 0, 3, 0, 0],
        average: [0, 0, 0, 14666, 0, 0],
      },
    })
  })
})
