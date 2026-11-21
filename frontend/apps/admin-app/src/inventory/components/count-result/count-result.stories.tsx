import type { Meta, StoryObj } from '@storybook/react-vite'
import { salon } from '../../../bookings/components/examples'
import { PRODUCTS_OF_THE_SALON } from '../../../products/components/examples'
import { COUNT_OF_THE_SALON, STOCK_OF_THE_SALON } from '../examples'
import { CountResult } from './count-result'

const meta: Meta<typeof CountResult> = {
  title: 'Admin/Inventory/CountResult',
  component: CountResult,
  args: {
    discrepancies: COUNT_OF_THE_SALON.discrepancies,
    rows: STOCK_OF_THE_SALON,
    products: PRODUCTS_OF_THE_SALON,
    rowHref: (inventoryId) => `/salons/${salon.id}/inventory/${inventoryId}`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Two rows differed from the books: one less, one more */
export const Differed: Story = {}

/** Every row counted was as the books said */
export const NoneDiffered: Story = {
  args: { discrepancies: [] },
}

/** A row of a product the salon no longer carries differed */
export const OfARemovedProduct: Story = {
  args: { products: [] },
}
