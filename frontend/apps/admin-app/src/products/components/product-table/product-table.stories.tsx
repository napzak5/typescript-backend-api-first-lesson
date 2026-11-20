import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { PRODUCTS_OF_THE_SALON } from '../examples'
import { ProductTable } from './product-table'

const meta: Meta<typeof ProductTable> = {
  title: 'Admin/Products/ProductTable',
  component: ProductTable,
  args: {
    caption: '商品台帳',
    rows: PRODUCTS_OF_THE_SALON,
    total: 4,
    currency: salon.currency,
    more: 'none',
    onMore: fn(),
    productHref: (productId) => `/salons/${salon.id}/products/${productId}`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A colour for treatments, a shampoo for both, gloves for neither, and a wax the salon no longer carries */
export const Ledger: Story = {}

/** More products can be asked for */
export const WithMore: Story = {
  args: { total: 64, more: 'available' },
}
