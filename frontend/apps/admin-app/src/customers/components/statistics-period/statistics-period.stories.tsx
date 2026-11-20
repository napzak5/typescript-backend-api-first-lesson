import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { StatisticsPeriod } from './statistics-period'

const meta: Meta<typeof StatisticsPeriod> = {
  title: 'Admin/Customers/StatisticsPeriod',
  component: StatisticsPeriod,
  args: {
    period: { from: '2025-11-20', to: '2026-11-20' },
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The year up to today */
export const LastYear: Story = {}

/** A period longer than the API counts over */
export const WithErrors: Story = {
  args: {
    errors: { to: '期間は 366 日までにしてください。' },
  },
}
