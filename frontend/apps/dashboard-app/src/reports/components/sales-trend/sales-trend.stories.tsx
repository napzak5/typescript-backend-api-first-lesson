import type { Meta, StoryObj } from '@storybook/react-vite'
import { partsOf } from '../../utils/sales-trends'
import { trends } from '../examples'
import { SalesTrend } from './sales-trend'

const meta: Meta<typeof SalesTrend> = {
  title: 'Dashboard/Reports/SalesTrend',
  component: SalesTrend,
  args: { parts: partsOf(trends), unit: 'monthly', currency: 'JPY' },
}

export default meta

type Story = StoryObj<typeof meta>

/** Twelve months, one of them without a sale */
export const Months: Story = {}

/** The days of a week */
export const Days: Story = {
  args: {
    unit: 'daily',
    parts: [
      { label: '2026-11-16', sales: 5500, transactions: 1, average: 5500 },
      { label: '2026-11-17', sales: 0, transactions: 0, average: 0 },
      { label: '2026-11-18', sales: 12_100, transactions: 2, average: 6050 },
    ],
  },
}
