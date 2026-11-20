import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { PRODUCTS_OF_THE_SALON } from '../../../products/components/examples'
import { STOCK_OF_THE_SALON, TODAY } from '../examples'
import { StockTable } from './stock-table'

const meta: Meta<typeof StockTable> = {
  title: 'Admin/Inventory/StockTable',
  component: StockTable,
  args: {
    caption: '在庫',
    rows: STOCK_OF_THE_SALON,
    products: PRODUCTS_OF_THE_SALON,
    today: TODAY,
    total: 4,
    more: 'none',
    onMore: fn(),
    rowHref: (inventoryId) => `/salons/${salon.id}/inventory/${inventoryId}`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Two lots of a colour, one of them past its expiry, a shampoo, and gloves of which none is left */
export const Stock: Story = {}

/** More rows can be asked for */
export const WithMore: Story = {
  args: { total: 45, more: 'available' },
}

/** A row of a product that was removed meanwhile: the products read have it no longer */
export const OfARemovedProduct: Story = {
  args: { products: PRODUCTS_OF_THE_SALON.slice(1) },
}
