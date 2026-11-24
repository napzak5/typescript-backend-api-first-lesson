import { keywordError } from '@beauty-salon-frontend/salon-screens'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ChartFilter } from './chart-filter'

const meta: Meta<typeof ChartFilter> = {
  title: 'Admin/Charts/ChartFilter',
  component: ChartFilter,
  args: {
    conditions: {},
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Every chart */
export const Everything: Story = {}

/** Both conditions, filled in */
export const Narrowed: Story = {
  args: {
    conditions: { search: 'ジアミン', allergies: 'with' },
    clearHref: '?',
  },
}

/** A keyword that is too long */
export const WithErrors: Story = {
  args: {
    errors: { search: keywordError('あ'.repeat(101)) },
  },
}
