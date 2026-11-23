import { ButtonLink } from '@beauty-salon-frontend/ui'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { PRODUCTS_OF_THE_SALON } from '../../../products/components/examples'
import { countedControlOf } from '../../utils/stock-count'
import { productOf, quantityNameOf } from '../../utils/stock-format'
import { expiredColour, STOCK_OF_THE_SALON, shampooRow } from '../examples'
import { CountForm } from './count-form'

const { count } = adminInventoryMessages

const meta: Meta<typeof CountForm> = {
  title: 'Admin/Inventory/CountForm',
  component: CountForm,
  args: {
    rows: STOCK_OF_THE_SALON,
    products: PRODUCTS_OF_THE_SALON,
    submitLabel: '記録する',
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

/** Every row of the salon, with what the books say of it */
export const Rows: Story = {}

/** What the form checked before sending: a count that is no quantity, and one below what is reserved */
export const WithErrors: Story = {
  args: {
    errors: {
      [countedControlOf(expiredColour.id)]: count.errors.count,
      [countedControlOf(shampooRow.id)]: count.errors.belowReserved(
        quantityNameOf(
          shampooRow.reservedStock,
          productOf(PRODUCTS_OF_THE_SALON, shampooRow.productId),
        ),
      ),
    },
  },
}

/** A row counted was removed meanwhile: the rows were read anew */
export const RowsChanged: Story = {
  args: {
    message: count.rowsChanged,
  },
}
