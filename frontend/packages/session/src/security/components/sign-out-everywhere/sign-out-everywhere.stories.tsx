import { NOT_SENT_MESSAGE } from '@beauty-salon-frontend/answers'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'
import { SignOutEverywhere } from './sign-out-everywhere'

const meta: Meta<typeof SignOutEverywhere> = {
  title: 'Session/Security/SignOutEverywhere',
  component: SignOutEverywhere,
  parameters: {
    // A modal dialog covers its page: in the documentation each story has a frame of its own
    docs: { story: { inline: false, height: '24rem' } },
  },
  args: {
    open: false,
    onOpen: fn(),
    onClose: fn(),
    onConfirm: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Offered: Story = {}

/** The dialog asks before every device is signed out */
export const Confirming: Story = {
  args: { open: true },
}

export const Sending: Story = {
  args: { open: true, pending: true },
}

/** The sign-out did not reach the API: the dialog stays, and says so */
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
      <SignOutEverywhere
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
