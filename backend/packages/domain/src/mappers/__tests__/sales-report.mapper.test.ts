import { describe, expect, it } from 'vitest'
import { SALON_ID } from '../../__tests__/fixtures/fixtures'
import {
  dayFigures,
  periodQuery,
  salesFigures,
  salesPeriod,
  staffFigures,
} from '../../__tests__/fixtures/sales-report-fixtures'
import {
  OTHER_STAFF_MEMBER_ID,
  STAFF_MEMBER_ID,
} from '../../__tests__/fixtures/staff-fixtures'
import { TOP_STAFF } from '../../business-logic/sales-report'
import {
  dailySalesGetRequestSchema,
  salesReportGetRequestSchema,
  salesTrendsGetRequestSchema,
} from '../../schemas/sales-report.schema'
import { SalesReportReadMapper } from '../read/sales-report.mapper'
import { SalesReportWriteMapper } from '../write/sales-report.mapper'

describe('SalesReportWriteMapper', () => {
  it('counts a report over the salon and the days the query names', () => {
    expect(
      SalesReportWriteMapper.fromGetRequest(
        salesReportGetRequestSchema.parse(periodQuery()),
      ),
    ).toStrictEqual(salesPeriod())
  })

  it('counts the sales of a day over a period of that day alone', () => {
    expect(
      SalesReportWriteMapper.fromDailyGetRequest(
        dailySalesGetRequestSchema.parse({
          salonId: SALON_ID,
          date: '2026-11-20',
        }),
      ),
    ).toStrictEqual(
      salesPeriod({ startDate: '2026-11-20', endDate: '2026-11-20' }),
    )
  })

  it.each<['daily' | 'weekly' | 'monthly']>([
    ['daily'],
    ['weekly'],
    ['monthly'],
  ])(
    'tells the days of the trends from what they are cut into: %s',
    (period) => {
      expect(
        SalesReportWriteMapper.fromTrendsGetRequest(
          salesTrendsGetRequestSchema.parse(periodQuery({ period })),
        ),
      ).toStrictEqual({ period: salesPeriod(), unit: period })
    },
  )
})

describe('SalesReportReadMapper.toApiSalesByMethod', () => {
  it('puts the largest amount first, each with its part of all of them', () => {
    expect(
      SalesReportReadMapper.toApiSalesByMethod([
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
    const rows = SalesReportReadMapper.toApiSalesByMethod([
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
      SalesReportReadMapper.toApiSalesByMethod([
        { method: 'cash', amount: 0, count: 1 },
        { method: 'credit_card', amount: 0, count: 2 },
      ]),
    ).toEqual([
      { method: 'cash', amount: 0, count: 1, percentage: 0 },
      { method: 'credit_card', amount: 0, count: 2, percentage: 0 },
    ])
  })

  it('has no row without a payment', () => {
    expect(SalesReportReadMapper.toApiSalesByMethod([])).toEqual([])
  })
})

describe('SalesReportReadMapper.toApiSalesByCategory', () => {
  it('puts the largest amount first and equal amounts in the order of the kinds, each with its part', () => {
    expect(
      SalesReportReadMapper.toApiSalesByCategory([
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
    expect(SalesReportReadMapper.toApiSalesByCategory([])).toEqual([])
  })
})

describe('SalesReportReadMapper.toApiSalesByStaff', () => {
  it('puts the staff member who brought in most first, with the average of their services', () => {
    expect(
      SalesReportReadMapper.toApiSalesByStaff(salesFigures().staff),
    ).toEqual([
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
    const [row] = SalesReportReadMapper.toApiSalesByStaff([
      staffFigures({ totalSales: 15000, serviceSales: 10000, serviceCount: 3 }),
    ])

    expect(row).toMatchObject({
      totalSales: 15000,
      serviceCount: 3,
      averageServiceValue: 3333,
    })
  })

  it('gives an average of 0 to a staff member who sold products alone', () => {
    const [row] = SalesReportReadMapper.toApiSalesByStaff([
      staffFigures({ totalSales: 4000, serviceSales: 0, serviceCount: 0 }),
    ])

    expect(row).toMatchObject({ serviceCount: 0, averageServiceValue: 0 })
  })

  it('puts staff members of equal amounts in the order of their IDs', () => {
    const rows = SalesReportReadMapper.toApiSalesByStaff([
      staffFigures({ staffId: OTHER_STAFF_MEMBER_ID }),
      staffFigures({ staffId: STAFF_MEMBER_ID }),
    ])

    expect(rows.map(({ staffId }) => staffId)).toEqual([
      STAFF_MEMBER_ID,
      OTHER_STAFF_MEMBER_ID,
    ])
  })
})

describe('SalesReportReadMapper.toApiSalesReport', () => {
  it('adds the days up, takes the refunds off and divides the sales', () => {
    expect(
      SalesReportReadMapper.toApiSalesReport(salesPeriod(), salesFigures()),
    ).toEqual({
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
      SalesReportReadMapper.toApiSalesReport(salesPeriod(), {
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

    const { topStaff } = SalesReportReadMapper.toApiSalesReport(
      salesPeriod(),
      salesFigures({ staff }),
    )

    expect(topStaff.map(({ totalSales }) => totalSales)).toEqual([
      6000, 5000, 4000, 3000, 2000,
    ])
  })
})

describe('SalesReportReadMapper.toApiDailySales', () => {
  it('reports the sales of the day and what the refunds leave of them', () => {
    expect(
      SalesReportReadMapper.toApiDailySales('2026-11-20', salesFigures().days),
    ).toEqual({
      date: '2026-11-20',
      sales: 33000,
      transactions: 2,
      refunds: 2000,
      net: 31000,
    })
  })

  it('reports a day without a sale in zeros', () => {
    expect(
      SalesReportReadMapper.toApiDailySales('2026-11-22', salesFigures().days),
    ).toEqual({
      date: '2026-11-22',
      sales: 0,
      transactions: 0,
      refunds: 0,
      net: 0,
    })
  })
})

describe('SalesReportReadMapper.toApiSalesTrends', () => {
  const days = [
    dayFigures({ saleDate: '2026-11-18', sales: 10000, transactions: 3 }),
    dayFigures({ saleDate: '2026-11-22', sales: 5000, transactions: 1 }),
    dayFigures({ saleDate: '2026-11-23', sales: 7000, transactions: 2 }),
    dayFigures({ saleDate: '2026-12-01', sales: 9000, transactions: 1 }),
  ]

  it('gives every day of the period, those without a sale too', () => {
    expect(
      SalesReportReadMapper.toApiSalesTrends(
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
      SalesReportReadMapper.toApiSalesTrends(
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
      SalesReportReadMapper.toApiSalesTrends(
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

    expect(
      SalesReportReadMapper.toApiSalesTrends(oneDay, 'daily', ofTheDay).labels,
    ).toEqual(['2026-11-22'])
    expect(
      SalesReportReadMapper.toApiSalesTrends(oneDay, 'weekly', ofTheDay),
    ).toEqual({
      labels: ['2026-11-16'],
      sales: [5000],
      transactions: [1],
      average: [5000],
    })
    expect(
      SalesReportReadMapper.toApiSalesTrends(oneDay, 'monthly', ofTheDay)
        .labels,
    ).toEqual(['2026-11'])
  })

  it('gives as many days as a period of 366 days has', () => {
    const { labels } = SalesReportReadMapper.toApiSalesTrends(
      salesPeriod({ startDate: '2027-11-17', endDate: '2028-11-16' }),
      'daily',
      [],
    )

    expect(labels).toHaveLength(366)
    expect(labels).toContain('2028-02-29')
    expect(labels.at(-1)).toBe('2028-11-16')
  })
})
