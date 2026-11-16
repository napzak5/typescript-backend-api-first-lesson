import { describe, expect, it } from 'vitest'
import {
  dailyOf,
  EXPORT_COLUMNS,
  exportOf,
  reportOf,
} from '../business-logic/sales-report'
import { dayFigures, salesFigures, salesPeriod } from './sales-report-fixtures'

/** The lines of a file, without the empty text after the last line end. */
const linesOf = (content: string): string[] =>
  content.endsWith('\r\n') ? content.slice(0, -2).split('\r\n') : ['(no end)']

/** The values of the lines of a file after its first, column by column. */
const columnsOf = (content: string): number[][] => {
  const rows = linesOf(content)
    .slice(1)
    .map((line) => line.split(',').slice(1).map(Number))

  return Array.from({ length: 6 }, (_, column) =>
    rows.map((row) => row[column] ?? Number.NaN),
  )
}

const sumOf = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value, 0)

describe('exportOf', () => {
  it('names the file after its period', () => {
    expect(exportOf(salesPeriod(), []).fileName).toBe(
      'sales-report-2026-11-01-2026-11-30.csv',
    )
  })

  it('begins with the names of the columns, and ends every line with CRLF', () => {
    const { content } = exportOf(salesPeriod(), salesFigures().days)

    expect(EXPORT_COLUMNS).toBe(
      'date,sales,tax,discounts,transactions,refunds,net',
    )
    expect(content.startsWith(`${EXPORT_COLUMNS}\r\n`)).toBe(true)
    expect(content.endsWith('\r\n')).toBe(true)
    expect(content.split('\n')).toHaveLength(32)
    expect(content.split('\r\n')).toHaveLength(32)
  })

  it('has a line for every day of the period, in their order, a day without a sale in zeros', () => {
    const lines = linesOf(exportOf(salesPeriod(), salesFigures().days).content)

    expect(lines.slice(1).map((line) => line.split(',')[0])).toEqual(
      Array.from(
        { length: 30 },
        (_, index) => `2026-11-${String(index + 1).padStart(2, '0')}`,
      ),
    )
    expect(lines[1]).toBe('2026-11-01,0,0,0,0,0,0')
    expect(lines[20]).toBe('2026-11-20,33000,3000,1000,2,2000,31000')
    expect(lines[21]).toBe('2026-11-21,11000,1000,0,1,0,11000')
    expect(lines[30]).toBe('2026-11-30,0,0,0,0,0,0')
  })

  it('writes the first and the last day of the period like the others', () => {
    const days = [
      dayFigures({ saleDate: '2026-11-01', sales: 5500, tax: 500 }),
      dayFigures({ saleDate: '2026-11-30', discounts: 300, refunds: 1100 }),
    ]

    const lines = linesOf(exportOf(salesPeriod(), days).content)

    expect(lines[1]).toBe('2026-11-01,5500,500,0,1,0,5500')
    expect(lines[30]).toBe('2026-11-30,11000,1000,300,1,1100,9900')
  })

  it('writes a period of one day as one line', () => {
    const period = salesPeriod({
      startDate: '2026-11-20',
      endDate: '2026-11-20',
    })

    expect(exportOf(period, salesFigures().days)).toEqual({
      fileName: 'sales-report-2026-11-20-2026-11-20.csv',
      content: `${EXPORT_COLUMNS}\r\n2026-11-20,33000,3000,1000,2,2000,31000\r\n`,
    })
  })

  it('writes a line for each of the 366 days of a leap year', () => {
    const period = salesPeriod({
      startDate: '2028-01-01',
      endDate: '2028-12-31',
    })

    const lines = linesOf(exportOf(period, []).content)

    expect(lines).toHaveLength(367)
    expect(lines[60]).toBe('2028-02-29,0,0,0,0,0,0')
    expect(lines[366]).toBe('2028-12-31,0,0,0,0,0,0')
  })

  it('adds up the figures of one day, as the sales of a day are', () => {
    const days = [
      dayFigures({ tax: 1000, discounts: 200, refunds: 500 }),
      dayFigures({ sales: 2200, tax: 200, discounts: 100, transactions: 2 }),
    ]

    const line = linesOf(exportOf(salesPeriod(), days).content)[20]

    expect(line).toBe('2026-11-20,13200,1200,300,3,500,12700')
    expect(dailyOf('2026-11-20', days)).toEqual({
      date: '2026-11-20',
      sales: 13200,
      transactions: 3,
      refunds: 500,
      net: 12700,
    })
  })

  it('leaves out figures of days outside the period', () => {
    const days = [
      dayFigures({ saleDate: '2026-10-31' }),
      dayFigures({ saleDate: '2026-12-01' }),
    ]

    const [sales] = columnsOf(exportOf(salesPeriod(), days).content)

    expect(sumOf(sales ?? [])).toBe(0)
  })

  it('has columns whose totals are those of the report of the period', () => {
    const figures = salesFigures()
    const report = reportOf(salesPeriod(), figures)

    const [sales, tax, discounts, transactions, refunds, net] = columnsOf(
      exportOf(salesPeriod(), figures.days).content,
    ).map(sumOf)

    expect({ sales, tax, discounts, transactions, refunds, net }).toEqual({
      sales: report.totalSales,
      tax: report.totalTax,
      discounts: report.totalDiscounts,
      transactions: report.transactionCount,
      refunds: report.totalRefunds,
      net: report.netSales,
    })
  })
})
