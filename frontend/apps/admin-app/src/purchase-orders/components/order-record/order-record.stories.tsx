import type { Meta, StoryObj } from '@storybook/react-vite'
import { salon, staff } from '../../../bookings/components/examples'
import { cancelledOrder, orderedGloves, pendingOrder } from '../examples'
import { OrderRecord } from './order-record'

const meta: Meta<typeof OrderRecord> = {
  title: 'Admin/PurchaseOrders/OrderRecord',
  component: OrderRecord,
  args: {
    order: pendingOrder,
    timezone: salon.timezone,
    currency: salon.currency,
    staff,
    rowHref: (inventoryId) => `/salons/${salon.id}/inventory/${inventoryId}`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A draft of a member of the staff waiting for approval, with notes of two lines */
export const Pending: Story = {}

/** Gloves made and approved by an administrator, with a shipping cost: the salon names nobody */
export const OrderedByAnAdministrator: Story = {
  args: { order: orderedGloves },
}

/** An order that was cancelled, of a stock row removed since */
export const Cancelled: Story = {
  args: { order: cancelledOrder },
}

/** While the staff are read: nobody is named yet */
export const WhileTheStaffAreRead: Story = {
  args: { staff: undefined },
}
