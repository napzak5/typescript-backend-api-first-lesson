import type { Meta, StoryObj } from '@storybook/react-vite'
import { aSchedule, aWeek, MONDAY } from '../examples'
import { ShiftTable } from './shift-table'

const meta: Meta<typeof ShiftTable> = {
  title: 'Admin/Shifts/ShiftTable',
  component: ShiftTable,
  args: {
    monday: MONDAY,
    members: [
      { id: 'tanaka', name: 'Misaki Tanaka', rows: aSchedule() },
      { id: 'suzuki', name: 'Yui Suzuki', rows: aWeek() },
      { id: 'mori', name: 'Ren Mori', rows: [] },
    ],
    scheduleHref: (id) => `/salons/salon/shifts/${id}`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/**
 * A member with a whole schedule (a training on Wednesday, shorter hours on
 * Saturday, Sunday off), one who works the weekly rows alone, and one who
 * has no schedule
 */
export const Week: Story = {}

/** What a member of the staff sees: their own row */
export const OwnRow: Story = {
  args: {
    members: [{ id: 'tanaka', name: 'Misaki Tanaka', rows: aSchedule() }],
  },
}
