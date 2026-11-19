import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'
import { BookingChanges } from './booking-changes'

const meta: Meta<typeof BookingChanges> = {
  title: 'Admin/Bookings/BookingChanges',
  component: BookingChanges,
  parameters: {
    // A modal dialog covers its page: in the documentation each story has a frame of its own
    docs: { story: { inline: false, height: '30rem' } },
  },
  args: {
    moveHref: '/salons/1/bookings/2/reschedule',
    lineEntryHref: '/salons/1/bookings/2/services/new',
    notesHref: '/salons/1/bookings/2/edit',
    removable: true,
    when: '2026年11月20日（金） 10:00〜11:00',
    open: false,
    onOpen: fn(),
    onClose: fn(),
    onRemove: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** What the owner, a manager or the operator can do with a booking */
export const Offered: Story = {}

/** A member of the staff changes what was written down, and removes nothing */
export const NotRemovable: Story = {
  args: { removable: false },
}

/** A booking that was carried out: it is not moved, and takes no lines */
export const Closed: Story = {
  args: { moveHref: undefined, lineEntryHref: undefined },
}

/** The dialog asks before the booking is removed */
export const Confirming: Story = {
  args: { open: true },
}

/** The removal is on its way */
export const Removing: Story = {
  args: { open: true, pending: true },
}

/** The removal did not come through: the dialog stays, and says so */
export const Unremoved: Story = {
  args: {
    open: true,
    message:
      '予約を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
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
