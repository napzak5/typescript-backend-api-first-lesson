import type { Meta, StoryObj } from '@storybook/react-vite'
import { aCustomer, salon } from '../../../bookings/components/examples'
import { PointBalance } from './point-balance'

const meta: Meta<typeof PointBalance> = {
  title: 'Admin/Customers/PointBalance',
  component: PointBalance,
  args: {
    balance: 2700,
    entryHref: `/salons/${salon.id}/customers/${aCustomer().id}/points/new`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The points of a customer, and the way to record more */
export const Balance: Story = {}

/** A customer who has no point */
export const Nothing: Story = {
  args: { balance: 0 },
}
