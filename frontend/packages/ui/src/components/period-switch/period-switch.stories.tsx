import type { Meta, StoryObj } from '@storybook/react-vite'
import { PeriodSwitch } from './period-switch'

const meta: Meta<typeof PeriodSwitch> = {
  title: 'Components/PeriodSwitch',
  component: PeriodSwitch,
  args: {
    label: '予約の日',
    unit: 'day',
    beforeHref: '?date=2026-11-19',
    currentHref: '?date=2026-11-20',
    afterHref: '?date=2026-11-21',
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Days: Story = {}

export const Weeks: Story = {
  args: {
    label: 'シフトの週',
    unit: 'week',
    beforeHref: '?week=2026-11-09',
    currentHref: '?',
    afterHref: '?week=2026-11-23',
  },
}

/** Today is shown, and what comes after it is not counted yet */
export const WithoutAfter: Story = {
  args: { label: 'ほかの日', afterHref: undefined },
}

/** The first day that is counted is shown */
export const WithoutBefore: Story = {
  args: { label: 'ほかの日', beforeHref: undefined },
}
