import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { MovementFilter } from './movement-filter'

const meta: Meta<typeof MovementFilter> = {
  title: 'Admin/Inventory/MovementFilter',
  component: MovementFilter,
  args: {
    conditions: {},
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Every movement */
export const Everything: Story = {}

/** The uses in treatments of a month */
export const Narrowed: Story = {
  args: {
    conditions: { type: 'use', from: '2026-11-01', to: '2026-11-30' },
    clearHref: '?',
  },
}

/** A last day before the first */
export const WithErrors: Story = {
  args: {
    errors: {
      to: '終わりの日は、始まりの日と同じか、その後にしてください。',
    },
  },
}
