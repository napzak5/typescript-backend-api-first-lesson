import { ButtonLink } from '@beauty-salon-frontend/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import {
  colourLot,
  STOCK_OF_THE_SALON,
} from '../../../inventory/components/examples'
import { PRODUCTS_OF_THE_SALON } from '../../../products/components/examples'
import { quantityControlOf, unitPriceControlOf } from '../../order-entry'
import { OrderForm } from './order-form'

const meta: Meta<typeof OrderForm> = {
  title: 'Admin/PurchaseOrders/OrderForm',
  component: OrderForm,
  args: {
    rows: STOCK_OF_THE_SALON,
    products: PRODUCTS_OF_THE_SALON,
    salon,
    submitLabel: '発注を作る',
    actions: (
      <ButtonLink href={`/salons/${salon.id}/purchase-orders`} variant='quiet'>
        やめる
      </ButtonLink>
    ),
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Every row of the salon, priced at what its product is bought at */
export const Rows: Story = {}

/** What the form checked before sending: no supplier, a quantity that is none, and a price too large for it */
export const WithErrors: Story = {
  args: {
    errors: {
      supplier: '仕入先を入力してください。',
      [quantityControlOf(colourLot.id)]:
        '数量は、0 より大きく 99,999,999.99 までの数（小数は 2 桁まで）で入力してください。',
      [unitPriceControlOf(colourLot.id)]:
        '単価は、0 以上の円の整数で入力してください。',
      taxAmount: '税額を入力してください。税がかからなければ 0 にします。',
    },
  },
}

/** A row ordered was removed meanwhile: the rows were read anew */
export const RowsChanged: Story = {
  args: {
    message:
      '発注する在庫の行のどれかが、その間に削除されました。在庫の行を読み直しました。数量を確かめて、もう一度作ってください。',
  },
}

/** The order is on its way */
export const Sending: Story = {
  args: { pending: true },
}
