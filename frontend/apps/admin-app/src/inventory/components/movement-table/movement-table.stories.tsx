import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon, staff } from '../../../bookings/components/examples'
import { colour } from '../../../products/components/examples'
import { MOVEMENTS_OF_THE_LOT } from '../examples'
import { MovementTable } from './movement-table'

const meta: Meta<typeof MovementTable> = {
  title: 'Admin/Inventory/MovementTable',
  component: MovementTable,
  args: {
    caption: '在庫の移動',
    movements: MOVEMENTS_OF_THE_LOT,
    product: colour,
    staff,
    timezone: salon.timezone,
    currency: salon.currency,
    total: 5,
    more: 'none',
    onMore: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The movements of a lot of the colour, from the stock it began with to a disposal */
export const Movements: Story = {}

/** More movements can be asked for */
export const WithMore: Story = {
  args: { total: 32, more: 'available' },
}

/** The product of the row was removed: the quantities have no unit */
export const OfARemovedProduct: Story = {
  args: { product: undefined },
}
