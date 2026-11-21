import type { Meta, StoryObj } from '@storybook/react-vite'
import { salon } from '../../../bookings/components/examples'
import { VALUE_OF_THE_SALON } from '../examples'
import { ValueReport } from './value-report'

const meta: Meta<typeof ValueReport> = {
  title: 'Admin/Inventory/ValueReport',
  component: ValueReport,
  args: {
    report: VALUE_OF_THE_SALON,
    currency: salon.currency,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The shampoo and the colour, the most valuable first */
export const Value: Story = {}

/** Some gloves left as well: a supply of no category and no purchase price */
export const WithoutACategory: Story = {
  args: {
    report: {
      ...VALUE_OF_THE_SALON,
      totalItems: 3,
      categories: [
        ...VALUE_OF_THE_SALON.categories,
        { category: null, itemCount: 1, value: 0 },
      ],
    },
  },
}

/** No product of the salon has any stock */
export const NoStock: Story = {
  args: {
    report: { totalValue: 0, totalItems: 0, categories: [] },
  },
}
