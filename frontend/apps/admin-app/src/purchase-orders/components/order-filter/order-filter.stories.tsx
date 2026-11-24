import { salonScreenMessages } from '@beauty-salon-shared/i18n/messages/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { OrderFilter } from './order-filter'

const ORDERS = `/salons/${salon.id}/purchase-orders`

const meta: Meta<typeof OrderFilter> = {
  title: 'Admin/PurchaseOrders/OrderFilter',
  component: OrderFilter,
  args: {
    conditions: {},
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Every order of the salon */
export const Every: Story = {}

/** The orders of a supplier waiting for approval, made over some days */
export const Narrowed: Story = {
  args: {
    conditions: {
      status: 'pending',
      supplier: 'Beauty Supply Tokyo',
      from: '2026-11-01',
      to: '2026-11-20',
    },
    clearHref: ORDERS,
  },
}

/** A last day before the first */
export const WithErrors: Story = {
  args: {
    conditions: { from: '2026-11-20' },
    errors: { to: salonScreenMessages.period.endBeforeStart },
    clearHref: ORDERS,
  },
}
