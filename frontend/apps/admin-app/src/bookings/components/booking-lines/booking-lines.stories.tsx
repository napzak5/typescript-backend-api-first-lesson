import { adminBookingMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aBooking, moment, salon, service, services, staff } from '../examples'
import { BookingLines } from './booking-lines'

const { errors } = adminBookingMessages.entry

const meta: Meta<typeof BookingLines> = {
  title: 'Admin/Bookings/BookingLines',
  component: BookingLines,
  args: {
    staff,
    services: [
      ...services,
      {
        ...service('b8e3c9f6-5d7a-4cfe-9cab-9b6d2e5f7ab9', '縮毛矯正', 16500),
        duration: 180,
        isActive: false,
      },
    ],
    errors: {},
    timezone: salon.timezone,
    onRowsChange: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The line a booking opens with */
export const OneLine: Story = {}

/** What the API refused, or the form found, at the controls of a line */
export const WithErrors: Story = {
  args: {
    errors: {
      'services.0.serviceId': errors.service,
      'services.0.startTime': errors.startTime,
    },
  },
}

/** The member of the line is taken by a booking that overlaps it */
export const Taken: Story = {
  args: {
    checks: [
      {
        type: 'taken',
        overlapping: [aBooking({ startTime: moment(30), endTime: moment(90) })],
      },
    ],
  },
}

/** The member of the line takes more than one booking at once, and is free still */
export const FreeBeside: Story = {
  args: { checks: [{ type: 'free', overlapping: [aBooking()] }] },
}

/** The member of the line is free */
export const Free: Story = {
  args: { checks: [{ type: 'free', overlapping: [] }] },
}

/** The line has no member, and takes nobody's time */
export const Unassigned: Story = {
  args: { checks: [{ type: 'unassigned' }] },
}

/** The member of the line could not be checked */
export const Unchecked: Story = {
  args: { checks: [{ type: 'failed' }] },
}
