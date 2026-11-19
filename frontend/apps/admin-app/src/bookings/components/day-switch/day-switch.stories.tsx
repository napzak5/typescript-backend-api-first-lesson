import type { Meta, StoryObj } from '@storybook/react-vite'
import { DaySwitch } from './day-switch'

const meta: Meta<typeof DaySwitch> = {
  title: 'Admin/Bookings/DaySwitch',
  component: DaySwitch,
  args: {
    dayBeforeHref: '?date=2026-11-19',
    todayHref: '?date=2026-11-20',
    dayAfterHref: '?date=2026-11-21',
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Days: Story = {}
