import type { Meta, StoryObj } from '@storybook/react-vite'
import { aBooking, moment, salon } from '../examples'
import { LineCheckNote } from './line-check-note'

const meta: Meta<typeof LineCheckNote> = {
  title: 'Admin/Bookings/LineCheckNote',
  component: LineCheckNote,
  args: {
    check: { type: 'free', overlapping: [] },
    timezone: salon.timezone,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Nobody overlaps the time of the member */
export const Free: Story = {}

/** The member takes more than one at once, and another booking is within that */
export const FreeBeside: Story = {
  args: { check: { type: 'free', overlapping: [aBooking()] } },
}

/** The member is taken by a booking that overlaps the time */
export const Taken: Story = {
  args: {
    check: {
      type: 'taken',
      overlapping: [aBooking({ startTime: moment(30), endTime: moment(90) })],
    },
  },
}

/** The line has no member, who would be taken */
export const Unassigned: Story = {
  args: { check: { type: 'unassigned' } },
}

/** The API could not be asked */
export const Unchecked: Story = {
  args: { check: { type: 'failed' } },
}
