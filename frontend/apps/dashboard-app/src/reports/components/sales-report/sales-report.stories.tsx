import type { Meta, StoryObj } from '@storybook/react-vite'
import { report, SALON_ID } from '../examples'
import { SalesReport } from './sales-report'

const meta: Meta<typeof SalesReport> = {
  title: 'Dashboard/Reports/SalesReport',
  component: SalesReport,
  args: {
    report,
    currency: 'JPY',
    staffHref: `/salons/${SALON_ID}/reports/staff?from=2026-11-01&to=2026-11-21`,
    categoriesHref: `/salons/${SALON_ID}/reports/categories?from=2026-11-01&to=2026-11-21`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A month of sales, paid in two ways, a part of them given back */
export const Counted: Story = {}

/** Products alone, sold by nobody of the staff and not paid yet */
export const WithoutBreakdown: Story = {
  args: {
    report: {
      ...report,
      totalSales: 3300,
      totalTax: 300,
      totalDiscounts: 0,
      totalRefunds: 0,
      netSales: 3300,
      transactionCount: 1,
      averageTransactionValue: 3300,
      salesByMethod: [],
      salesByCategory: [],
      topStaff: [],
    },
  },
}
