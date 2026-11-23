import { tooLongOf } from '@beauty-salon-frontend/fields'
import { ButtonLink } from '@beauty-salon-frontend/ui'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import {
  colour,
  gloves,
  PRODUCTS_OF_THE_SALON,
  shampoo,
} from '../../../products/components/examples'
import { LONGEST_SHELF } from '../../utils/stock-form'
import { colourLot, shampooRow } from '../examples'

import { StockForm } from './stock-form'

const meta: Meta<typeof StockForm> = {
  title: 'Admin/Inventory/StockForm',
  component: StockForm,
  args: {
    row: null,
    products: [colour, shampoo, gloves],
    submitLabel: '足す',
    actions: (
      <ButtonLink href={`/salons/${salon.id}/inventory`} variant='quiet'>
        やめる
      </ButtonLink>
    ),
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A new row of one of the products the salon carries */
export const New: Story = {}

/** A lot of the colour as it is kept */
export const Recorded: Story = {
  args: {
    row: colourLot,
    products: PRODUCTS_OF_THE_SALON,
    submitLabel: '変更を保存する',
  },
}

/** The shampoo, not kept by lots: the form has no lot */
export const WithoutLots: Story = {
  args: {
    row: shampooRow,
    products: PRODUCTS_OF_THE_SALON,
    submitLabel: '変更を保存する',
  },
}

/** A lot of the colour, after the colour was no longer kept by lots: the lot can only be cleared */
export const LotToClear: Story = {
  args: {
    row: colourLot,
    products: [{ ...colour, requiresLotTracking: false }],
    submitLabel: '変更を保存する',
  },
}

/** What the form checked before sending: no product, a day that does not exist, a shelf too long */
export const WithErrors: Story = {
  args: {
    errors: {
      productId: adminInventoryMessages.errors.product,
      expiryDate: adminInventoryMessages.errors.expiry,
      shelf: tooLongOf(adminInventoryMessages.form.shelf, LONGEST_SHELF),
    },
  },
}

/** The API refused the account */
export const Refused: Story = {
  args: {
    row: colourLot,
    products: PRODUCTS_OF_THE_SALON,
    submitLabel: '変更を保存する',
    message: adminInventoryMessages.forbidden,
  },
}
