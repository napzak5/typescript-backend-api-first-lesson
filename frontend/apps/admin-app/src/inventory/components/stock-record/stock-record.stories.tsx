import type { Meta, StoryObj } from '@storybook/react-vite'
import { salon, staff } from '../../../bookings/components/examples'
import { colour, shampoo } from '../../../products/components/examples'
import { colourLot, expiredColour, shampooRow, TODAY } from '../examples'
import { StockRecord } from './stock-record'

const meta: Meta<typeof StockRecord> = {
  title: 'Admin/Inventory/StockRecord',
  component: StockRecord,
  args: {
    row: colourLot,
    product: colour,
    today: TODAY,
    timezone: salon.timezone,
    staff,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A lot of the colour, counted at the start of the month by a member of the staff */
export const Counted: Story = {}

/** The same lot, counted by an administrator, who is no member of the staff */
export const CountedByAnAdministrator: Story = {
  args: { row: { ...colourLot, lastCountedBy: null } },
}

/** The same lot, while the staff of the salon are read */
export const WhileTheStaffAreRead: Story = {
  args: { staff: undefined },
}

/** A lot past its expiry, never counted */
export const Expired: Story = {
  args: { row: expiredColour },
}

/** The shampoo, without lots, reserved in part, with notes of two lines */
export const WithNotes: Story = {
  args: { row: shampooRow, product: shampoo },
}

/** A row of a product that was removed meanwhile */
export const OfARemovedProduct: Story = {
  args: { product: undefined },
}
