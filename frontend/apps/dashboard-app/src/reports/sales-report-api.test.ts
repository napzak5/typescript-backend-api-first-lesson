import {
  answering,
  problem,
  record,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  byCategory,
  byStaff,
  daily,
  report,
  SALON_ID,
  trends,
} from './components/examples'
import {
  exportSalesReport,
  readDailySales,
  readSalesByCategory,
  readSalesByStaff,
  readSalesReport,
  readSalesTrends,
  salesByCategoryKeyOf,
  salesByStaffKeyOf,
  salesReportKeyOf,
} from './sales-report-api'

/*
 * The answers the real API gives are met in the screen tests. Here are
 * those a test cannot bring about there, and what the functions ask for.
 */

const PERIOD = { from: '2026-11-01', to: '2026-11-21' }

const CALLS: [string, () => Promise<{ type: string }>][] = [
  ['readSalesReport', () => readSalesReport(SALON_ID, PERIOD)],
  ['exportSalesReport', () => exportSalesReport(SALON_ID, PERIOD)],
  ['readSalesTrends', () => readSalesTrends(SALON_ID, PERIOD, 'weekly')],
  ['readDailySales', () => readDailySales(SALON_ID, '2026-11-21')],
  ['readSalesByStaff', () => readSalesByStaff(SALON_ID, PERIOD)],
  ['readSalesByCategory', () => readSalesByCategory(SALON_ID, PERIOD)],
]

const CSV = 'date,sales,tax,discounts,transactions,refunds,net\r\n'

/** The file of a report, as the API answers with it */
const csvFile = (disposition: string | null): Response =>
  new Response(CSV, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      ...(disposition === null ? {} : { 'Content-Disposition': disposition }),
    },
  })

describe('the sales report', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe.each(CALLS)('%s', (_name, call) => {
    it.each(UNREAD)(
      'should say why nothing came of %s',
      async (_case, answer, type) => {
        // Arrange
        answering(answer)

        // Act, Assert
        expect(await call()).toEqual({ type })
      },
    )

    it('should say that the salon is not there any more when the API names it as the value it refused', async () => {
      // Arrange
      answering(() => problem(400, [{ field: 'salonId', rule: 'not_found' }]))

      // Act, Assert
      expect(await call()).toEqual({ type: 'notFound' })
    })

    it('should say that the report of another salon is not the account’s', async () => {
      // Arrange
      answering(() => problem(403))

      // Act, Assert
      expect(await call()).toEqual({ type: 'forbidden' })
    })

    it('should fail on a refusal of what the screen does not send', async () => {
      // Arrange
      answering(() => problem(400, [{ field: 'endDate', rule: 'custom' }]))

      // Act, Assert
      expect(await call()).toEqual({ type: 'failed' })
    })
  })

  it('should ask for the sales of the salon whose day is in the period', async () => {
    // Arrange
    const fetched = answering(() => record(200, report))

    // Act
    const read = await readSalesReport(SALON_ID, PERIOD)

    // Assert
    expect(read).toEqual({ type: 'found', report })
    const asked = new URL(String(fetched.mock.calls[0]?.[0]))
    expect(asked.pathname).toBe('/api/v1/sales-reports')
    expect(Object.fromEntries(asked.searchParams)).toEqual({
      salonId: SALON_ID,
      startDate: '2026-11-01',
      endDate: '2026-11-21',
    })
  })

  it('should ask for the trend of the period, cut into the parts chosen', async () => {
    // Arrange
    const fetched = answering(() => record(200, trends))

    // Act
    const read = await readSalesTrends(SALON_ID, PERIOD, 'weekly')

    // Assert
    expect(read).toEqual({ type: 'found', trends })
    const asked = new URL(String(fetched.mock.calls[0]?.[0]))
    expect(asked.pathname).toBe('/api/v1/sales-reports/trends')
    expect(Object.fromEntries(asked.searchParams)).toEqual({
      salonId: SALON_ID,
      startDate: '2026-11-01',
      endDate: '2026-11-21',
      period: 'weekly',
    })
  })

  it.each<[string, () => Promise<unknown>, unknown, string, unknown]>([
    [
      'every member of the staff',
      () => readSalesByStaff(SALON_ID, PERIOD),
      byStaff,
      '/api/v1/sales-reports/by-staff',
      { type: 'found', staff: byStaff },
    ],
    [
      'every kind of service',
      () => readSalesByCategory(SALON_ID, PERIOD),
      byCategory,
      '/api/v1/sales-reports/by-category',
      { type: 'found', categories: byCategory },
    ],
  ])(
    'should ask for the sales of the period of %s',
    async (_case, readOf, data, path, found) => {
      // Arrange
      const fetched = answering(() => record(200, data))

      // Act
      const read = await readOf()

      // Assert
      expect(read).toEqual(found)
      const asked = new URL(String(fetched.mock.calls[0]?.[0]))
      expect(asked.pathname).toBe(path)
      expect(Object.fromEntries(asked.searchParams)).toEqual({
        salonId: SALON_ID,
        startDate: '2026-11-01',
        endDate: '2026-11-21',
      })
    },
  )

  it('should keep every read of the sales under a key of its own, the reads of one salon under one key', () => {
    // Arrange
    const keys = [
      salesReportKeyOf(SALON_ID, PERIOD),
      salesByStaffKeyOf(SALON_ID, PERIOD),
      salesByCategoryKeyOf(SALON_ID, PERIOD),
      salesByStaffKeyOf(SALON_ID, { from: PERIOD.from, to: PERIOD.from }),
    ]

    // Assert
    expect(new Set(keys.map((key) => JSON.stringify(key))).size).toBe(
      keys.length,
    )
    const ofTheSalon = salesReportKeyOf(SALON_ID, PERIOD).slice(0, -2)
    expect(keys.map((key) => key.slice(0, ofTheSalon.length))).toEqual(
      keys.map(() => ofTheSalon),
    )
  })

  it('should ask for the sales of one day', async () => {
    // Arrange
    const fetched = answering(() => record(200, daily))

    // Act
    const read = await readDailySales(SALON_ID, '2026-11-21')

    // Assert
    expect(read).toEqual({ type: 'found', sales: daily })
    const asked = new URL(String(fetched.mock.calls[0]?.[0]))
    expect(asked.pathname).toBe('/api/v1/sales-reports/daily')
    expect(Object.fromEntries(asked.searchParams)).toEqual({
      salonId: SALON_ID,
      date: '2026-11-21',
    })
  })

  it('should keep the file of the period as the API wrote it, under the name it gave', async () => {
    // Arrange
    const fetched = answering(() =>
      csvFile('attachment; filename=sales-report-2026-11-01-2026-11-21.csv'),
    )

    // Act
    const exported = await exportSalesReport(SALON_ID, PERIOD)

    // Assert
    expect(exported).toEqual({
      type: 'exported',
      file: {
        name: 'sales-report-2026-11-01-2026-11-21.csv',
        type: 'text/csv; charset=utf-8',
        content: CSV,
      },
    })
    const asked = new URL(String(fetched.mock.calls[0]?.[0]))
    expect(asked.pathname).toBe('/api/v1/sales-reports/export')
    expect(Object.fromEntries(asked.searchParams)).toEqual({
      salonId: SALON_ID,
      startDate: '2026-11-01',
      endDate: '2026-11-21',
    })
  })

  it('should save nothing of a file the answer names no name for', async () => {
    // Arrange
    answering(() => csvFile(null))

    // Act, Assert
    expect(await exportSalesReport(SALON_ID, PERIOD)).toEqual({
      type: 'failed',
    })
  })
})
