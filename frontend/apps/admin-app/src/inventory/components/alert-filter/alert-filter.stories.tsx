import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { AlertFilter } from './alert-filter'

const meta: Meta<typeof AlertFilter> = {
  title: 'Admin/Inventory/AlertFilter',
  component: AlertFilter,
  args: {
    conditions: {},
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Every alert */
export const Everything: Story = {}

/** The critical alerts of stock rows past their expiry that nobody saw to */
export const Narrowed: Story = {
  args: {
    conditions: { alert: 'expired', severity: 'critical', acknowledged: false },
    clearHref: '?',
  },
}
