import { NOT_SENT_MESSAGE } from '@beauty-salon-frontend/answers'
import { securityMessages } from '@beauty-salon-shared/i18n/messages/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { TwoFactorPasswordForm } from './two-factor-password-form'

const meta: Meta<typeof TwoFactorPasswordForm> = {
  title: 'Session/Security/TwoFactorPasswordForm',
  component: TwoFactorPasswordForm,
  args: {
    cancelHref: '/account/security',
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Empty: Story = {}

/** The API did not take the password */
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

/** The password did not reach the API */
export const Unsent: Story = {
  args: {
    message: NOT_SENT_MESSAGE,
  },
}
