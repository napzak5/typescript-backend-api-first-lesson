import * as formats from '@beauty-salon-shared/i18n/formats'
import { adminBookingMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'
import { moment, salon } from '../examples'
import { LineRemoval } from './line-removal'

const { removal: REMOVAL } = adminBookingMessages.moves

const meta: Meta<typeof LineRemoval> = {
  title: 'Admin/Bookings/LineRemoval',
  component: LineRemoval,
  parameters: {
    // A modal dialog covers its page: in the documentation each story has a frame of its own
    docs: { story: { inline: false, height: '30rem' } },
  },
  args: {
    why: undefined,
    what: REMOVAL.lineOf(
      'カット',
      formats.timeRangeAt(moment(0), moment(60), salon.timezone),
    ),
    open: false,
    onOpen: fn(),
    onClose: fn(),
    onRemove: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A line of a booking that has another */
export const Offered: Story = {}

/** The dialog asks before the line is taken away */
export const Confirming: Story = {
  args: { open: true },
}

/** The removal is on its way */
export const Removing: Story = {
  args: { open: true, pending: true },
}

/** The removal did not come through */
export const Unremoved: Story = {
  args: {
    open: true,
    message: REMOVAL.failed,
  },
}

/** The last line of a booking stays */
export const Last: Story = {
  args: {
    why: REMOVAL.last,
  },
}

/** The dialog opens from its button, and closes from its button that changes nothing */
export const OpenedByButton: Story = {
  render: (args) => {
    const [open, setOpen] = useState(false)

    return (
      <LineRemoval
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
