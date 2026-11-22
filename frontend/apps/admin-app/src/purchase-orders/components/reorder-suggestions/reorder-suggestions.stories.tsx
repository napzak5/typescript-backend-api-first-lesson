import type { Meta, StoryObj } from '@storybook/react-vite'
import { suggestionGroupsOf } from '../../utils/order-suggestions'
import { SUGGESTIONS_OF_THE_SALON } from '../examples'
import { ReorderSuggestions } from './reorder-suggestions'

const meta: Meta<typeof ReorderSuggestions> = {
  title: 'Admin/PurchaseOrders/ReorderSuggestions',
  component: ReorderSuggestions,
  args: {
    groups: suggestionGroupsOf(SUGGESTIONS_OF_THE_SALON),
    timezone: 'Asia/Tokyo',
    entryHrefOf: (supplier) =>
      `/salons/salon/purchase-orders/new?suggested=${encodeURIComponent(supplier ?? '')}`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The suggestions of two suppliers, and of products that name none */
export const BySupplier: Story = {}

/** The suggestions of one supplier */
export const OneSupplier: Story = {
  args: {
    groups: suggestionGroupsOf(SUGGESTIONS_OF_THE_SALON.slice(0, 1)),
  },
}
