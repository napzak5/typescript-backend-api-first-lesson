import { NOT_SENT_MESSAGE } from '@beauty-salon-frontend/answers'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'
import { booking, WHEN } from '../examples'
import { BookingChanges } from './booking-changes'

const meta: Meta<typeof BookingChanges> = {
  title: 'Portal/Bookings/BookingChanges',
  component: BookingChanges,
  parameters: {
    // A modal dialog covers its page: in the documentation each story has a frame of its own
    docs: { story: { inline: false, height: '30rem' } },
  },
  args: {
    moveHref: `/bookings/${booking.id}/reschedule`,
    when: WHEN,
    open: false,
    onOpen: fn(),
    onClose: fn(),
    onCancel: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** What can be done with a booking that has not begun */
export const Offered: Story = {}

/** A booking the salon added a service to: the salon moves it */
export const WithoutMove: Story = {
  args: { moveHref: undefined },
}

/** The dialog asks before the booking is cancelled */
export const Confirming: Story = {
  args: { open: true },
}

/** The cancellation is on its way */
export const Sending: Story = {
  args: { open: true, pending: true },
}

/** The cancellation did not reach the API: the dialog stays, and says so */
export const Unsent: Story = {
  args: {
    open: true,
    message: NOT_SENT_MESSAGE,
  },
}

/** Opened by its button and closed by the button that changes nothing: how a screen uses it. */
export const OpenedByButton: Story = {
  render: (args) => {
    const [open, setOpen] = useState(false)

    return (
      <BookingChanges
        {...args}
        open={open}
        onOpen={() => {
          setOpen(true)
          args.onOpen()
        }}
        onClose={() => {
          setOpen(false)
          args.onClose()
        }}
      />
    )
  },
}
