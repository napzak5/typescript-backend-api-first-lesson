import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { aBooking, DAY, moment, salon, services, staff } from '../examples'
import { BookingEntryForm } from './booking-entry-form'

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
    checked:
      '明細 1 の担当に、重なる予約があります。担当の前後の空け時間も、重なりに数えます。担当か開始の時刻を変えてください。',
  },
}

/** What the API refused, said above the form and at the controls */
export const Refused: Story = {
  args: {
    message: '入力内容を確かめてください。',
    errors: {
      staffId: '担当スタッフを選んでください。',
      'services.0.serviceId': 'メニューを選んでください。',
    },
  },
}

/** The booking is on its way */
export const Sending: Story = {
  args: { pending: true },
}
