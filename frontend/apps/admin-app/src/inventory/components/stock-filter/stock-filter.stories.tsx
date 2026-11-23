import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import {
  colour,
  PRODUCTS_OF_THE_SALON,
} from '../../../products/components/examples'
import { LOT_TOO_LONG } from '../../utils/lot-number'
import { StockFilter } from './stock-filter'

const meta: Meta<typeof StockFilter> = {
  title: 'Admin/Inventory/StockFilter',
  component: StockFilter,
  args: {
    view: { type: 'all' },
    products: PRODUCTS_OF_THE_SALON,
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Every row */
export const Everything: Story = {}

/** The rows of a lot of the colour */
export const Narrowed: Story = {
  args: {
    view: { type: 'all', productId: colour.id, lotNumber: 'LOT-2026-041' },
    clearHref: '?',
  },
}

/** A lot that is too long */
export const WithErrors: Story = {
  args: {
    errors: { lotNumber: LOT_TOO_LONG },
  },
}

/** The rows that expire within a week */
export const Expiring: Story = {
  args: { view: { type: 'expiring', days: 7 } },
}
