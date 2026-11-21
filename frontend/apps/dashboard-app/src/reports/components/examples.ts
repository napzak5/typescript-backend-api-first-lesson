import type { ModelsSalesReportResponse } from '@beauty-salon-frontend/api-client'

/*
 * What the stories of the sales reports show: a month of a salon in
 * Tokyo, counted as the API counts it.
 */

/** The salon the examples are of */
export const SALON_ID = '3b8e2f4a-6c1d-4e9b-8a7f-2d5c9e1b4a60'

/** A month of sales: two paid in cash and by card, one refunded in part, one not paid yet */
export const report: ModelsSalesReportResponse = {
  salonId: SALON_ID,
  startDate: '2026-11-01',
  endDate: '2026-11-21',
  totalSales: 41_800,
  totalTax: 3800,
  totalDiscounts: 1000,
  totalRefunds: 3000,
  netSales: 38_800,
  transactionCount: 4,
  averageTransactionValue: 10_450,
  salesByMethod: [
    { method: 'credit_card', amount: 16_000, count: 2, percentage: 66.7 },
    { method: 'cash', amount: 8000, count: 1, percentage: 33.3 },
  ],
  salesByCategory: [
    { category: 'color', amount: 17_600, count: 2, percentage: 50 },
    { category: 'cut', amount: 12_100, count: 2, percentage: 34.4 },
    { category: 'treatment', amount: 5500, count: 1, percentage: 15.6 },
  ],
  topStaff: [
    {
      staffId: '7a1c2e3f-4b5d-4e6f-8a9b-0c1d2e3f4a5b',
      displayName: 'Mika Suzuki',
      totalSales: 23_100,
      serviceCount: 3,
      averageServiceValue: 7700,
    },
    {
      staffId: '8b2d3f4a-5c6e-4f7a-9b0c-1d2e3f4a5b6c',
      displayName: 'Hiroshi Tanaka',
      totalSales: 12_100,
      serviceCount: 2,
      averageServiceValue: 6050,
    },
  ],
}
