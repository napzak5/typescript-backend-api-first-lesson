import type { Meta, StoryObj } from '@storybook/react-vite'
import { byCategory } from '../examples'
import { CategorySales } from './category-sales'

const meta: Meta<typeof CategorySales> = {
  title: 'Dashboard/Reports/CategorySales',
  component: CategorySales,
  args: { categories: byCategory, currency: 'JPY' },
}

export default meta

type Story = StoryObj<typeof meta>

/** Four kinds of service, one of them services of no category */
export const Counted: Story = {}

/** One kind of service, all of the sales */
export const OneKind: Story = {
  args: {
    categories: [
      { category: 'cut', amount: 12_100, count: 3, percentage: 100 },
    ],
  },
}
