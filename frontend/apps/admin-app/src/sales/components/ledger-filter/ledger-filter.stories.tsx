import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { LedgerFilter } from './ledger-filter'

const meta: Meta<typeof LedgerFilter> = {
  title: 'Admin/Sales/LedgerFilter',
  component: LedgerFilter,
  args: {
    conditions: { from: '2026-11-20', to: '2026-11-20' },
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Today's sales */
export const Today: Story = {}

/** The sales of a month that are paid in part */
export const Narrowed: Story = {
  args: {
    conditions: {
      from: '2026-11-01',
      to: '2026-11-30',
      paymentStatus: 'processing',
    },
    clearHref: '?',
  },
}

/** A range whose end comes before its start */
export const WithErrors: Story = {
  args: {
    conditions: { from: '2026-11-10', to: '2026-11-10' },
    errors: {
      to: '終わりの日は、始まりの日と同じか、その後にしてください。',
    },
  },
}
