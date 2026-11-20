import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { CustomerFilter } from './customer-filter'

const meta: Meta<typeof CustomerFilter> = {
  title: 'Admin/Customers/CustomerFilter',
  component: CustomerFilter,
  args: {
    conditions: { tags: [] },
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The whole ledger */
export const Everyone: Story = {}

/** Every condition, filled in */
export const Narrowed: Story = {
  args: {
    conditions: {
      search: '山田',
      tags: ['VIP', '常連'],
      from: '2026-11-01',
      to: '2026-11-20',
      customerStatus: 'vip',
      membershipTier: 'gold',
    },
    clearHref: '?',
  },
}

/** A range whose end comes before its start */
export const WithErrors: Story = {
  args: {
    conditions: { tags: [], from: '2026-11-10' },
    errors: {
      to: '終わりの日は、始まりの日と同じか、その後にしてください。',
    },
  },
}
