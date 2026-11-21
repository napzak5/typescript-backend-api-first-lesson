import type { Meta, StoryObj } from '@storybook/react-vite'
import { daily } from '../examples'
import { DailySales } from './daily-sales'

const meta: Meta<typeof DailySales> = {
  title: 'Dashboard/Reports/DailySales',
  component: DailySales,
  args: { sales: daily, currency: 'JPY' },
}

export default meta

type Story = StoryObj<typeof meta>

/** Two sales, a part of one given back */
export const Sold: Story = {}

/** A day without a sale */
export const NothingSold: Story = {
  args: {
    sales: {
      date: '2026-11-22',
      sales: 0,
      transactions: 0,
      refunds: 0,
      net: 0,
    },
  },
}
