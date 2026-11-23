import { TextArea } from '@beauty-salon-frontend/ui'
import { portalBookingMessages } from '@beauty-salon-shared/i18n/messages/portal'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { bookableStaff, DAY, TODAY, times } from '../examples'
import { BookingForm } from './booking-form'

const meta: Meta<typeof BookingForm> = {
  title: 'Portal/Bookings/BookingForm',
  component: BookingForm,
  args: {
    staff: bookableStaff,
    choice: { staffId: undefined, date: DAY },
    today: TODAY,
    onChoose: fn(),
    times: { type: 'listed', times },
    onRetry: fn(),
    children: (
      <TextArea
        label='ご要望'
        name='customerRequest'
        rows={4}
        description='サロンに伝えておきたいことがあれば、ご記入ください。'
      />
    ),
    submitLabel: 'この内容で予約する',
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The times of a day, with whoever is free */
export const WithTimes: Story = {}

/** The times of one member of the staff */
export const WithStaffChosen: Story = {
  args: {
    choice: { staffId: bookableStaff.at(1)?.id, date: DAY },
    times: { type: 'listed', times: times.slice(0, 6) },
  },
}

/** Today: there is no day before it to go to */
export const Today: Story = {
  args: {
    choice: { staffId: undefined, date: TODAY },
    times: { type: 'listed', times: times.slice(8) },
  },
}

/** The times of the day are being read */
export const ReadingTimes: Story = {
  args: { times: { type: 'loading' } },
}

/** A day without a time: there is nothing to send */
export const WithoutTimes: Story = {
  args: { times: { type: 'listed', times: [] } },
}

export const TimesUnread: Story = {
  args: {
    times: { type: 'unread', reason: { type: 'failed' }, retrying: false },
  },
}

export const ReadingTimesAgain: Story = {
  args: {
    times: { type: 'unread', reason: { type: 'failed' }, retrying: true },
  },
}

export const TooManyRequests: Story = {
  args: {
    times: {
      type: 'unread',
      reason: { type: 'tooManyRequests' },
      retrying: false,
    },
  },
}

/** The form was sent without a time */
export const WithoutTimeChosen: Story = {
  args: { errors: { startTime: portalBookingMessages.flow.noStartTime } },
}

/** Somebody else booked the time first: the times were read again */
export const Refused: Story = {
  args: {
    message: portalBookingMessages.flow.notBooked,
    times: { type: 'listed', times: times.slice(1) },
  },
}

/** The booking is on its way */
export const Sending: Story = {
  args: { pending: true },
}

/** A booking is moved: the time is all there is to send */
export const Moving: Story = {
  args: {
    choice: { staffId: bookableStaff.at(0)?.id, date: DAY },
    children: undefined,
    submitLabel: 'この日時に変更する',
  },
}
