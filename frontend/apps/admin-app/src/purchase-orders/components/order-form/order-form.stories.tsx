import { ButtonLink } from '@beauty-salon-frontend/ui'
import { adminPurchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import {
  colourLot,
  STOCK_OF_THE_SALON,
  shampooRow,
} from '../../../inventory/components/examples'
import { PRODUCTS_OF_THE_SALON } from '../../../products/components/examples'
import { quantityControlOf, unitPriceControlOf } from '../../utils/order-entry'
import { OrderForm } from './order-form'

const { errors } = adminPurchaseOrderMessages.form.entry

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

/** A new order of the products suggested of a supplier: the newest lot of the colour, and the shampoo */
export const FromSuggestions: Story = {
  args: {
    starting: {
      supplier: 'ビューティーサプライ東京',
      quantities: { [colourLot.id]: '30', [shampooRow.id]: '12.5' },
    },
  },
}

/** What the form checked before sending: no supplier, a quantity that is none, and a price too large for it */
export const WithErrors: Story = {
  args: {
    errors: {
      supplier: errors.supplierMissing,
      [quantityControlOf(colourLot.id)]: errors.quantity,
      [unitPriceControlOf(colourLot.id)]: errors.unitPrice,
      taxAmount: errors.taxMissing,
    },
  },
}

/** A row ordered was removed meanwhile: the rows were read anew */
export const RowsChanged: Story = {
  args: {
    message: errors.rowsChanged,
  },
}

/** The order is on its way */
export const Sending: Story = {
  args: { pending: true },
}
