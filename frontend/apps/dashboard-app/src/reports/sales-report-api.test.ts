import {
  answering,
  json,
  problem,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { report, SALON_ID } from './components/examples'
import { exportSalesReport, readSalesReport } from './sales-report-api'

/*
 * The answers the real API gives are met in the screen tests. Here are
 * those a test cannot bring about there, and what the functions ask for.
 */

const PERIOD = { from: '2026-11-01', to: '2026-11-21' }

const CALLS: [string, () => Promise<{ type: string }>][] = [
  ['readSalesReport', () => readSalesReport(SALON_ID, PERIOD)],
  ['exportSalesReport', () => exportSalesReport(SALON_ID, PERIOD)],
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
    const fetched = answering(() =>
      json(200, { data: report, meta: null, links: { self: '/' } }),
    )

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
