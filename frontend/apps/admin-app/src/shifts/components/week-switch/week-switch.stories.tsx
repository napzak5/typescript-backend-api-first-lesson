import type { Meta, StoryObj } from '@storybook/react-vite'
import { WeekSwitch } from './week-switch'

const meta: Meta<typeof WeekSwitch> = {
  title: 'Admin/Shifts/WeekSwitch',
  component: WeekSwitch,
  args: {
    weekBeforeHref: '?week=2026-11-09',
    thisWeekHref: '?',
    weekAfterHref: '?week=2026-11-23',
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Weeks: Story = {}
