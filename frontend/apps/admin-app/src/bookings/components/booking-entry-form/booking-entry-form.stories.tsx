import { CHECK_THE_VALUES_MESSAGE } from '@beauty-salon-frontend/answers'
import { adminBookingMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aBooking, DAY, moment, salon, services, staff } from '../examples'
import { BookingEntryForm } from './booking-entry-form'

const { errors, checked } = adminBookingMessages.entry

const meta: Meta<typeof BookingEntryForm> = {
  title: 'Admin/Bookings/BookingEntryForm',
  component: BookingEntryForm,
  args: {
    staff,
    services,
    date: DAY,
    timezone: salon.timezone,
    onSubmit: fn(),
    onCheck: fn(),
    onLinesChange: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A booking the salon starts to put in, on the day of the list it came from */
export const Empty: Story = {}

/** The members of the lines are being checked */
export const Checking: Story = {
  args: { checking: true },
}

/** What the check found, at the line and in a sentence */
export const Checked: Story = {
  args: {
    checks: [
      {
        type: 'taken',
        overlapping: [aBooking({ startTime: moment(30), endTime: moment(90) })],
      },
    ],
    checked: checked.taken([1]),
  },
}

/** What the API refused, said above the form and at the controls */
export const Refused: Story = {
  args: {
    message: CHECK_THE_VALUES_MESSAGE,
    errors: {
      staffId: errors.staff,
      'services.0.serviceId': errors.service,
    },
  },
}

/** The booking is on its way */
export const Sending: Story = {
  args: { pending: true },
}
