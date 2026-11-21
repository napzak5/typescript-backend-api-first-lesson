import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { ORDERS_OF_THE_SALON } from '../examples'
import { OrderTable } from './order-table'

const meta: Meta<typeof OrderTable> = {
  title: 'Admin/PurchaseOrders/OrderTable',
  component: OrderTable,
  args: {
    caption: '発注',
    orders: ORDERS_OF_THE_SALON,
    timezone: salon.timezone,
    currency: salon.currency,
    orderHref: (id) => `/salons/${salon.id}/purchase-orders/${id}`,
    total: 3,
    more: 'none',
    onMore: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A draft waiting for approval, gloves ordered, and an order that was cancelled */
export const Orders: Story = {}

/** The first page of more orders than it shows */
export const More: Story = {
  args: {
    orders: ORDERS_OF_THE_SALON.slice(0, 2),
    total: 23,
    more: 'available',
  },
}
