import { NOT_SENT_MESSAGE } from '@beauty-salon-frontend/answers'
import { securityMessages } from '@beauty-salon-shared/i18n/messages/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { TwoFactorStopDialog } from './two-factor-stop-dialog'

const meta: Meta<typeof TwoFactorStopDialog> = {
  title: 'Session/Security/TwoFactorStopDialog',
  component: TwoFactorStopDialog,
  parameters: {
    // A modal dialog covers its page: in the documentation each story has a frame of its own
    docs: { story: { inline: false, height: '32rem' } },
  },
  args: {
    open: true,
    onClose: fn(),
    onStop: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Asking: Story = {}

/** Sent with nothing typed: each control says what it needs */
export const BothMissing: Story = {
  args: {
    errors: {
      password: securityMessages.twoFactorFlow.passwordMissing,
      code: securityMessages.twoFactorFlow.codeMissing,
    },
  },
}

/** The API did not take the password: it reads the code only after the password */
export const PasswordWrong: Story = {
  args: {
    errors: {
      password: securityMessages.twoFactorFlow.passwordWrong,
    },
  },
}

export const Sending: Story = {
  args: { pending: true },
}

/** The request did not reach the API */
export const Unsent: Story = {
  args: {
    message: NOT_SENT_MESSAGE,
  },
}
