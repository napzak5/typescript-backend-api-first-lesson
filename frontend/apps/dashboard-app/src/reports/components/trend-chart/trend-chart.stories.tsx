import type { Meta, StoryObj } from '@storybook/react-vite'
import { partsOf, type TrendPart } from '../../utils/sales-trends'
import { trends } from '../examples'
import { TrendChart } from './trend-chart'

/** Every day of a leap year, the sales rising toward its end */
const daysOfAYear: TrendPart[] = Array.from({ length: 366 }, (_, index) => {
  const day = new Date(Date.UTC(2023, 11, 1 + index))
  const sales = index % 7 === 1 ? 0 : 20_000 + index * 150

  return {
    label: day.toISOString().slice(0, 10),
    sales,
    transactions: sales === 0 ? 0 : 3,
    average: sales === 0 ? 0 : Math.floor(sales / 3),
  }
})

const meta: Meta<typeof TrendChart> = {
  title: 'Dashboard/Reports/TrendChart',
  component: TrendChart,
  args: { parts: partsOf(trends), unit: 'monthly', currency: 'JPY' },
}

export default meta

type Story = StoryObj<typeof meta>

/** Twelve months, one of them without a sale */
export const Months: Story = {}

/** The weeks of a month, the first and the last of them in part */
export const Weeks: Story = {
  args: {
    unit: 'weekly',
    parts: [
      { label: '2026-10-26', sales: 5500, transactions: 1, average: 5500 },
      { label: '2026-11-02', sales: 7700, transactions: 1, average: 7700 },
      { label: '2026-11-09', sales: 3300, transactions: 1, average: 3300 },
      { label: '2026-11-16', sales: 2200, transactions: 1, average: 2200 },
    ],
  },
}

/** Every day of a year: too many columns for a gap between them */
export const DaysOfAYear: Story = {
  args: { unit: 'daily', parts: daysOfAYear },
}

/** One day alone */
export const OneDay: Story = {
  args: {
    unit: 'daily',
    parts: [
      { label: '2026-11-21', sales: 13_200, transactions: 2, average: 6600 },
    ],
  },
}
