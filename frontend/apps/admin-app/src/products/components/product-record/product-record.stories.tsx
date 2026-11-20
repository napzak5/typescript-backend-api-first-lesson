import type { Meta, StoryObj } from '@storybook/react-vite'
import { salon } from '../../../bookings/components/examples'
import { gloves, shampoo } from '../examples'
import { ProductRecord } from './product-record'

const meta: Meta<typeof ProductRecord> = {
  title: 'Admin/Products/ProductRecord',
  component: ProductRecord,
  args: { product: shampoo, currency: salon.currency },
}

export default meta

type Story = StoryObj<typeof meta>

/** A shampoo, with everything the ledger keeps noted */
export const Noted: Story = {}

/** Supplies of which little is noted */
export const LittleNoted: Story = {
  args: { product: gloves },
}
