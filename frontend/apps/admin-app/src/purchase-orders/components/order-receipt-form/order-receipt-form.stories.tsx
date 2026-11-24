import { ButtonLink } from '@beauty-salon-frontend/ui'
import { adminPurchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { colourLot } from '../../../inventory/components/examples'
import { itemQuantityNameOf } from '../../utils/order-format'
import { receivedControlOf } from '../../utils/order-receipt'
import { shippedOrder } from '../examples'
import { OrderReceiptForm } from './order-receipt-form'

const { errors } = adminPurchaseOrderMessages.receipt

const meta: Meta<typeof OrderReceiptForm> = {
  title: 'Admin/PurchaseOrders/OrderReceiptForm',
  component: OrderReceiptForm,
  args: {
    order: shippedOrder,
    submitLabel: '入荷を記録する',
    actions: (
      <ButtonLink href='/salons/salon/purchase-orders/order' variant='quiet'>
        やめる
      </ButtonLink>
    ),
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A shipped order: the colour and the shampoo, and the wax of a stock row removed since */
export const Shipped: Story = {}

/** An order with no notes of the delivery, all of whose rows are there */
export const WithoutNotes: Story = {
  args: {
    order: {
      items: shippedOrder.items.filter(
        ({ inventoryId }) => inventoryId !== null,
      ),
      deliveryNotes: null,
    },
  },
}

/** What the form checked before sending: more than was ordered, and notes made empty */
export const WithErrors: Story = {
  args: {
    errors: {
      [receivedControlOf(colourLot.id)]: errors.quantity(
        itemQuantityNameOf({ quantity: 12, unit: '本' }),
      ),
      deliveryNotes: errors.notesKept,
    },
  },
}

/** A row was removed meanwhile: the order was read anew */
export const RowsChanged: Story = {
  args: {
    message: errors.rowsChanged,
  },
}

/** The receipt is on its way */
export const Sending: Story = {
  args: { pending: true },
}
