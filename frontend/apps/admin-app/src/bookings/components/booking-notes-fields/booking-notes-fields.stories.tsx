import type { Meta, StoryObj } from '@storybook/react-vite'
import { BookingNotesFields } from './booking-notes-fields'

const meta: Meta<typeof BookingNotesFields> = {
  title: 'Admin/Bookings/BookingNotesFields',
  component: BookingNotesFields,
  args: { errors: {} },
}

export default meta

type Story = StoryObj<typeof meta>

/** A new booking: nothing is written down yet */
export const Empty: Story = {}

/** What a booking of the portal has written down: its way is one the form does not offer */
export const Stored: Story = {
  args: {
    notes: {
      source: 'online',
      depositAmount: 3000,
      customerRequest: '前髪は、眉が隠れるくらいの長さにしたいです。',
      internalNotes: '前回より 1 トーン明るく。',
    },
  },
}

/** What the form found wrong, at its control */
export const WithErrors: Story = {
  args: {
    errors: {
      depositAmount: '予約金は、0 以上の円の整数で入力してください。',
    },
  },
}
