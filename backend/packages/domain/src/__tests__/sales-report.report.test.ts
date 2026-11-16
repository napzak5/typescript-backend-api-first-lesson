import { describe, expect, it } from 'vitest'
import {
  averageOf,
  categoryRowsOf,
  dailyOf,
  methodRowsOf,
  percentageOf,
  reportOf,
  staffRowsOf,
  TOP_STAFF,
  trendsOf,
} from '../business-logic/sales-report'
import {
  datesOf,
  daysIn,
  mondayOf,
  monthOf,
} from '../business-logic/sales-report/_shared/calendar'
import { SALON_ID } from './fixtures'
import {
  dayFigures,
  salesFigures,
  salesPeriod,
  staffFigures,
} from './sales-report-fixtures'
import { OTHER_STAFF_MEMBER_ID, STAFF_MEMBER_ID } from './staff-fixtures'

describe('the calendar of the reports', () => {
  it('counts the days of a period with both of its ends', () => {
    expect(daysIn('2026-11-20', '2026-11-20')).toBe(1)
    expect(daysIn('2026-11-01', '2026-11-30')).toBe(30)
    expect(daysIn('2025-01-01', '2025-12-31')).toBe(365)
  })

  it('counts the 29th of February of a leap year, and no such day of another year', () => {
    expect(daysIn('2028-02-28', '2028-03-01')).toBe(3)
    expect(daysIn('2027-02-28', '2027-03-01')).toBe(2)
    expect(daysIn('2028-01-01', '2028-12-31')).toBe(366)
  })

  it('counts every day as one, on the days the clocks of a time zone change', () => {
    expect(daysIn('2026-03-07', '2026-03-09')).toBe(3)
    expect(daysIn('2026-10-31', '2026-11-02')).toBe(3)
  })

  it('names every date of a period in its order, across the end of a month and of a year', () => {
    expect(datesOf('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ])
    expect(datesOf('2028-02-28', '2028-03-01')).toEqual([
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ])
    expect(datesOf('2026-11-20', '2026-11-20')).toEqual(['2026-11-20'])
  })

  it.each([
    ['a Monday', '2026-11-16', '2026-11-16'],
    ['a Wednesday', '2026-11-18', '2026-11-16'],
    ['a Sunday, the last day of its week', '2026-11-22', '2026-11-16'],
    ['a day whose Monday is in the year before', '2027-01-01', '2026-12-28'],
    ['a day whose Monday is in the month before', '2026-12-02', '2026-11-30'],
  ])('finds the Monday of the week of %s', (_case, date, monday) => {
    expect(mondayOf(date)).toBe(monday)
  })

  it('finds the month of a date', () => {
    expect(monthOf('2026-11-20')).toBe('2026-11')
    expect(monthOf('2027-01-01')).toBe('2027-01')
  })
})

describe('averageOf', () => {
  it('drops the fraction of a yen', () => {
    expect(averageOf(10000, 3)).toBe(3333)
    expect(averageOf(20000, 3)).toBe(6666)
    expect(averageOf(9000, 3)).toBe(3000)
  })

  it('is 0 when there is nothing to divide by', () => {
    expect(averageOf(0, 0)).toBe(0)
    expect(averageOf(5000, 0)).toBe(0)
  })
})

describe('percentageOf', () => {
  it('gives a part in per cent to one decimal place, rounded', () => {
    expect(percentageOf(1, 3)).toBe(33.3)
    expect(percentageOf(2, 3)).toBe(66.7)
    expect(percentageOf(1, 8)).toBe(12.5)
    expect(percentageOf(1, 2000)).toBe(0.1)
    expect(percentageOf(1, 2001)).toBe(0)
  })

  it('gives 100 for the whole and 0 for nothing of it', () => {
    expect(percentageOf(42000, 42000)).toBe(100)
    expect(percentageOf(0, 42000)).toBe(0)
  })

  it('is 0 of a whole of 0', () => {
    expect(percentageOf(0, 0)).toBe(0)
  })
})

describe('methodRowsOf', () => {
  it('puts the largest amount first, each with its part of all of them', () => {
    expect(
      methodRowsOf([
        { method: 'cash', amount: 10000, count: 1 },
        { method: 'e_money', amount: 20000, count: 3 },
        { method: 'credit_card', amount: 30000, count: 2 },
      ]),
    ).toEqual([
      { method: 'credit_card', amount: 30000, count: 2, percentage: 50 },
      { method: 'e_money', amount: 20000, count: 3, percentage: 33.3 },
      { method: 'cash', amount: 10000, count: 1, percentage: 16.7 },
    ])
  })

  it('puts kinds of equal amounts in the order of their names', () => {
    const rows = methodRowsOf([
      { method: 'qr_payment', amount: 5000, count: 1 },
      { method: 'cash', amount: 5000, count: 1 },
      { method: 'bank_transfer', amount: 5000, count: 1 },
    ])

    expect(rows.map(({ method }) => method)).toEqual([
      'bank_transfer',
      'cash',
      'qr_payment',
    ])
  })

  it('gives 0 per cent to kinds whose payments were all refunded, and to all of them when nothing is left', () => {
    expect(
      methodRowsOf([
        { method: 'cash', amount: 0, count: 1 },
        { method: 'credit_card', amount: 0, count: 2 },
      ]),
    ).toEqual([
      { method: 'cash', amount: 0, count: 1, percentage: 0 },
      { method: 'credit_card', amount: 0, count: 2, percentage: 0 },
    ])
  })

  it('has no row without a payment', () => {
    expect(methodRowsOf([])).toEqual([])
  })
})

describe('categoryRowsOf', () => {
  it('puts the largest amount first and equal amounts in the order of the kinds, each with its part', () => {
    expect(
      categoryRowsOf([
        { category: 'other', amount: 2000, count: 1 },
        { category: 'cut', amount: 4000, count: 2 },
        { category: 'color', amount: 4000, count: 1 },
      ]),
    ).toEqual([
      { category: 'color', amount: 4000, count: 1, percentage: 40 },
      { category: 'cut', amount: 4000, count: 2, percentage: 40 },
      { category: 'other', amount: 2000, count: 1, percentage: 20 },
    ])
  })

  it('has no row without a service line', () => {
    expect(categoryRowsOf([])).toEqual([])
  })
})

describe('staffRowsOf', () => {
  it('puts the staff member who brought in most first, with the average of their services', () => {
    expect(staffRowsOf(salesFigures().staff)).toEqual([
      {
        staffId: OTHER_STAFF_MEMBER_ID,
        displayName: 'Ren',
        totalSales: 33000,
        serviceCount: 4,
        averageServiceValue: 7500,
      },
      {
        staffId: STAFF_MEMBER_ID,
        displayName: 'Aoi',
        totalSales: 11000,
        serviceCount: 1,
        averageServiceValue: 11000,
      },
    ])
  })

  it('averages the service lines alone, dropping the fraction of a yen', () => {
    const [row] = staffRowsOf([
      staffFigures({ totalSales: 15000, serviceSales: 10000, serviceCount: 3 }),
    ])

    expect(row).toMatchObject({
      totalSales: 15000,
      serviceCount: 3,
      averageServiceValue: 3333,
    })
  })

  it('gives an average of 0 to a staff member who sold products alone', () => {
    const [row] = staffRowsOf([
      staffFigures({ totalSales: 4000, serviceSales: 0, serviceCount: 0 }),
    ])

    expect(row).toMatchObject({ serviceCount: 0, averageServiceValue: 0 })
  })

  it('puts staff members of equal amounts in the order of their IDs', () => {
    const rows = staffRowsOf([
      staffFigures({ staffId: OTHER_STAFF_MEMBER_ID }),
      staffFigures({ staffId: STAFF_MEMBER_ID }),
    ])

    expect(rows.map(({ staffId }) => staffId)).toEqual([
      STAFF_MEMBER_ID,
      OTHER_STAFF_MEMBER_ID,
    ])
  })
})

describe('reportOf', () => {
  it('adds the days up, takes the refunds off and divides the sales', () => {
    expect(reportOf(salesPeriod(), salesFigures())).toEqual({
      salonId: SALON_ID,
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      totalSales: 44000,
      totalTax: 4000,
      totalDiscounts: 1000,
      totalRefunds: 2000,
      netSales: 42000,
      transactionCount: 3,
      averageTransactionValue: 14666,
      salesByMethod: [
        {
          method: 'credit_card',
          amount: 31000,
          count: 2,
          percentage: 73.8,
        },
        { method: 'cash', amount: 11000, count: 1, percentage: 26.2 },
      ],
      salesByCategory: [
        { category: 'color', amount: 22000, count: 1, percentage: 50 },
        { category: 'cut', amount: 22000, count: 2, percentage: 50 },
      ],
      topStaff: [
        {
          staffId: OTHER_STAFF_MEMBER_ID,
          displayName: 'Ren',
          totalSales: 33000,
          serviceCount: 4,
          averageServiceValue: 7500,
        },
        {
          staffId: STAFF_MEMBER_ID,
          displayName: 'Aoi',
          totalSales: 11000,
          serviceCount: 1,
          averageServiceValue: 11000,
        },
      ],
    })
  })

  it('reports a period without a sale in zeros, with empty rows', () => {
    expect(
      reportOf(salesPeriod(), {
        days: [],
        methods: [],
        categories: [],
        staff: [],
      }),
    ).toMatchObject({
      totalSales: 0,
      totalTax: 0,
      totalDiscounts: 0,
      totalRefunds: 0,
      netSales: 0,
      transactionCount: 0,
      averageTransactionValue: 0,
      salesByMethod: [],
      salesByCategory: [],
      topStaff: [],
    })
  })

  it(`names the ${TOP_STAFF} staff members who brought in most`, () => {
    const amounts = [1000, 6000, 3000, 5000, 2000, 4000]
    const staff = amounts.map((totalSales, index) =>
      staffFigures({
        staffId: `0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f0${index}`,
        totalSales,
      }),
    )

    const { topStaff } = reportOf(salesPeriod(), salesFigures({ staff }))

    expect(topStaff.map(({ totalSales }) => totalSales)).toEqual([
      6000, 5000, 4000, 3000, 2000,
    ])
  })
})

describe('dailyOf', () => {
  it('reports the sales of the day and what the refunds leave of them', () => {
    expect(dailyOf('2026-11-20', salesFigures().days)).toEqual({
      date: '2026-11-20',
      sales: 33000,
      transactions: 2,
      refunds: 2000,
      net: 31000,
    })
  })

  it('reports a day without a sale in zeros', () => {
    expect(dailyOf('2026-11-22', salesFigures().days)).toEqual({
      date: '2026-11-22',
      sales: 0,
      transactions: 0,
      refunds: 0,
      net: 0,
    })
  })
})

describe('trendsOf', () => {
  const days = [
    dayFigures({ saleDate: '2026-11-18', sales: 10000, transactions: 3 }),
    dayFigures({ saleDate: '2026-11-22', sales: 5000, transactions: 1 }),
    dayFigures({ saleDate: '2026-11-23', sales: 7000, transactions: 2 }),
    dayFigures({ saleDate: '2026-12-01', sales: 9000, transactions: 1 }),
  ]

  it('gives every day of the period, those without a sale too', () => {
    expect(
      trendsOf(
        salesPeriod({ startDate: '2026-11-21', endDate: '2026-11-24' }),
        'daily',
        days,
      ),
    ).toEqual({
      labels: ['2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24'],
      sales: [0, 5000, 7000, 0],
      transactions: [0, 1, 2, 0],
      average: [0, 5000, 3500, 0],
    })
  })

  it('gives the weeks beginning on a Monday under their Monday, the first and the last counting only the days of the period', () => {
    expect(
      trendsOf(
        salesPeriod({ startDate: '2026-11-18', endDate: '2026-12-01' }),
        'weekly',
        days,
      ),
    ).toEqual({
      labels: ['2026-11-16', '2026-11-23', '2026-11-30'],
      sales: [15000, 7000, 9000],
      transactions: [4, 2, 1],
      average: [3750, 3500, 9000],
    })
  })

  it('gives the months, across the end of a year', () => {
    expect(
      trendsOf(
        salesPeriod({ startDate: '2026-11-15', endDate: '2027-01-10' }),
        'monthly',
        days,
      ),
    ).toEqual({
      labels: ['2026-11', '2026-12', '2027-01'],
      sales: [22000, 9000, 0],
      transactions: [6, 1, 0],
      average: [3666, 9000, 0],
    })
  })

  it('gives one part for a period of one day, whatever the unit', () => {
    const oneDay = salesPeriod({
      startDate: '2026-11-22',
      endDate: '2026-11-22',
    })
    const ofTheDay = days.filter(({ saleDate }) => saleDate === '2026-11-22')

    expect(trendsOf(oneDay, 'daily', ofTheDay).labels).toEqual(['2026-11-22'])
    expect(trendsOf(oneDay, 'weekly', ofTheDay)).toEqual({
      labels: ['2026-11-16'],
      sales: [5000],
      transactions: [1],
      average: [5000],
    })
    expect(trendsOf(oneDay, 'monthly', ofTheDay).labels).toEqual(['2026-11'])
  })

  it('gives as many days as a period of 366 days has', () => {
    const { labels } = trendsOf(
      salesPeriod({ startDate: '2027-11-17', endDate: '2028-11-16' }),
      'daily',
      [],
    )

    expect(labels).toHaveLength(366)
    expect(labels).toContain('2028-02-29')
    expect(labels.at(-1)).toBe('2028-11-16')
  })
})
