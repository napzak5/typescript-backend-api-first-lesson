import { ButtonLink } from '@beauty-salon-frontend/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { colourLot } from '../../../inventory/components/examples'
import { receivedControlOf } from '../../order-receipt'
import { shippedOrder } from '../examples'
import { OrderReceiptForm } from './order-receipt-form'

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
      [receivedControlOf(colourLot.id)]:
        '届いた数量は、0 より大きく、発注した 12 本 までの数（小数は 2 桁まで）で入力してください。',
      deliveryNotes:
        'いまの納品のメモは、入荷では消せません。そのまま残すか、書き換えてください。',
    },
  },
}

/** A row was removed meanwhile: the order was read anew */
export const RowsChanged: Story = {
  args: {
    message:
      '明細の在庫の行のどれかが、その間に削除されました。発注を読み直しました。届いた数量を確かめて、もう一度記録してください。',
  },
}

/** The receipt is on its way */
export const Sending: Story = {
  args: { pending: true },
}
