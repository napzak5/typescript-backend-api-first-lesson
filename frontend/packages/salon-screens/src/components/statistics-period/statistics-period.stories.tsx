import { RadioGroup } from '@beauty-salon-frontend/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { StatisticsPeriod } from './statistics-period'

const meta: Meta<typeof StatisticsPeriod> = {
  title: 'SalonScreens/StatisticsPeriod',
  component: StatisticsPeriod,
  args: {
    period: { from: '2025-11-20', to: '2026-11-20' },
    description: '366 日まで集計できます。',
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

/** A further choice of what is counted, below the days */
export const WithAChoice: Story = {
  args: {
    children: (
      <RadioGroup
        label='区切り'
        name='period'
        options={[
          { value: 'weekly', label: '週' },
          { value: 'monthly', label: '月' },
        ]}
        defaultValue='monthly'
        layout='columns'
      />
    ),
  },
}
