import { adminPurchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { pendingOrder } from '../examples'
import { OrderChangeForm } from './order-change-form'

const meta: Meta<typeof OrderChangeForm> = {
  title: 'Admin/PurchaseOrders/OrderChangeForm',
  component: OrderChangeForm,
  args: {
    order: pendingOrder,
    timezone: 'Asia/Tokyo',
    submitLabel: '変更を保存する',
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** An order with a day of delivery and notes */
export const Filled: Story = {}

/** An order with nothing written down yet */
export const Empty: Story = {
  args: {
    order: { expectedDelivery: null, deliveryNotes: null, notes: null },
  },
}

/** The day was not one the API takes */
export const WithErrors: Story = {
  args: {
    errors: { expectedDelivery: adminPurchaseOrderMessages.words.dayMissing },
  },
}

/** The changes are on their way */
export const Sending: Story = {
  args: { pending: true },
}
