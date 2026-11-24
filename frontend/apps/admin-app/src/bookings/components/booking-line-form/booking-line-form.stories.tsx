import { dayNameOf } from '@beauty-salon-frontend/salon-screens'
import { adminBookingMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aBooking, DAY, moment, salon, services, staff } from '../examples'
import { BookingLineForm } from './booking-line-form'

const { errors } = adminBookingMessages.entry

const meta: Meta<typeof BookingLineForm> = {
  title: 'Admin/Bookings/BookingLineForm',
  component: BookingLineForm,
  args: {
    staff,
    services,
    day: dayNameOf(DAY),
    timezone: salon.timezone,
    onValuesChange: fn(),
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Nothing chosen yet; the member of the booking does the line at first */
export const Empty: Story = {}

/** What was typed is no line: at the controls */
export const WithErrors: Story = {
  args: {
    errors: {
      serviceId: errors.service,
      startTime: errors.startTime,
    },
  },
}

/** The API refused the line: its member is taken by another booking */
export const Refused: Story = {
  args: {
    message: adminBookingMessages.moves.addition.taken,
    check: {
      type: 'taken',
      overlapping: [
        aBooking({
          id: 'c1f94d7a-6e8c-4adf-8dbe-ac7e3f6a8bc5',
          bookingNumber: 'BK-9QWE-3RTY',
          startTime: moment(60),
          endTime: moment(120),
        }),
      ],
    },
  },
}

/** The line is on its way */
export const Sending: Story = {
  args: { pending: true },
}
